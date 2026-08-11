//! Steam CM (Connection Manager) websocket client.
//!
//! A long-lived, authenticated websocket to a Steam CM server. Handles the
//! logon handshake, friend list + persona (presence) state, chat messages
//! (send via the `FriendMessages.SendMessage` service method, receive via
//! `FriendMessagesClient.IncomingMessage`), and heartbeats. One connection per
//! account; a background task owns the socket and dispatches envelopes into a
//! shared state (`CmData`) that commands read from.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use crate::client::SteamHttpClient;
use crate::cm::bootstrap;
use crate::cm::frame::{
    self, Envelope, EMSG_CLIENT_EMOTICON_LIST, EMSG_CLIENT_FRIENDS_LIST,
    EMSG_CLIENT_GET_EMOTICON_LIST, EMSG_CLIENT_HEARTBEAT, EMSG_CLIENT_LOGGED_OFF,
    EMSG_CLIENT_LOGON, EMSG_CLIENT_LOGON_RESPONSE, EMSG_CLIENT_LOG_OFF, EMSG_CLIENT_PERSONA_STATE,
    EMSG_SERVICE_METHOD, EMSG_SERVICE_METHOD_RESPONSE, EMSG_SERVICE_METHOD_SEND_TO_CLIENT,
    JOB_ID_NONE,
};
use crate::cm::proto_wire::{self, Writer};
use crate::proto_gen;
use prost::Message as _;

/// A friend relationship observed on logon.
#[derive(Debug, Clone)]
pub struct FriendState {
    pub steam_id: u64,
    pub relationship: u32,
}

/// A friend's persona / presence snapshot.
#[derive(Debug, Clone)]
pub struct PersonaState {
    pub steam_id: u64,
    pub persona_state: u32,
    pub player_name: Option<String>,
    pub avatar_hash: Option<Vec<u8>>,
    pub game_name: Option<String>,
    pub game_played_app_id: Option<u32>,
    pub last_logoff: Option<u32>,
}

/// An incoming chat message (from a friend or an echo of our own send).
#[derive(Debug, Clone)]
pub struct IncomingChat {
    pub partner_steam_id: u64,
    pub message: String,
    pub timestamp: u32,
    pub ordinal: u32,
    pub local_echo: bool,
    pub chat_entry_type: i32,
}

/// An incoming group (chat room) message from the CM.
#[derive(Debug, Clone)]
pub struct GroupIncoming {
    pub group_id: u64,
    pub chat_id: u64,
    pub sender_steam_id: u64,
    pub message: String,
    pub timestamp: u32,
    pub ordinal: u32,
}

/// One owned Steam sticker (from `CMsgClientEmoticonList`, field 2).
#[derive(Debug, Clone)]
pub struct Sticker {
    pub name: String,
    /// CDN URL for the sticker asset.
    pub image_url: String,
}

#[derive(Default)]
struct CmData {
    session_id: u32,
    friends: HashMap<u64, FriendState>,
    personas: HashMap<u64, PersonaState>,
    messages: VecDeque<IncomingChat>,
    group_messages: VecDeque<GroupIncoming>,
    next_job_id: i64,
    pending: HashMap<i64, oneshot::Sender<Result<Vec<u8>, String>>>,
    /// Pending `ClientEmoticonList` responder. Unlike service methods, client
    /// EMSGs are sent with `JOB_ID_NONE` and matched by emsg alone — Steam does
    /// not echo a correlating job id for them (mirrors Monica's CM client).
    emoticon_pending: Option<oneshot::Sender<Result<Vec<u8>, String>>>,
}

/// A generic correlated service-method call (`ChatRoom.*`, `FriendMessages.*`, …).
enum Cmd {
    CallService {
        method: String,
        request: Vec<u8>,
        reply: oneshot::Sender<Result<Vec<u8>, String>>,
    },
    /// Fetch the account's owned sticker catalogue via `ClientEmoticonList`.
    GetEmoticonList {
        reply: oneshot::Sender<Result<Vec<Sticker>, String>>,
    },
    /// Send `CMsgClientLogOff` and tear the socket down cleanly.
    LogOff,
}

/// Handle to an authenticated CM connection. Cheap to clone; the underlying
/// task owns the socket.
#[derive(Clone)]
pub struct CmClient {
    cmd_tx: mpsc::Sender<Cmd>,
    data: Arc<Mutex<CmData>>,
    task: Arc<tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

/// Connect to Steam CM and log on. `access_token` must be a fresh session
/// token for `steam_id`.
pub async fn connect(access_token: &str, steam_id: u64) -> Result<CmClient, String> {
    connect_with_seed(access_token, steam_id, Vec::new(), Vec::new()).await
}

/// Like [`connect`], but seeds the replacement session with messages drained
/// from a previous same-account connection, so nothing is lost during a
/// reconnect — Steam does not replay chat on a fresh logon.
pub async fn connect_with_seed(
    access_token: &str,
    steam_id: u64,
    seed_messages: Vec<IncomingChat>,
    seed_group_messages: Vec<GroupIncoming>,
) -> Result<CmClient, String> {
    let http = SteamHttpClient::new();
    let token = bootstrap::fetch_web_logon_token(&http, access_token, steam_id)
        .map_err(|e| format!("CM bootstrap failed: {}", e))?;
    let endpoints =
        bootstrap::fetch_endpoints(&http).map_err(|e| format!("CM list failed: {}", e))?;

    // eresult=5 = LoggedInElsewhere: Steam still holds the previous session
    // (e.g. after abrupt restarts or the desktop client being online). It
    // releases the stale session after its heartbeat timeout, so retry with
    // Monica-style exponential backoff (1s → 2s → 4s → … capped at 30s).
    let mut retry: u64 = 1;
    for attempt in 0..8 {
        let mut last_err: Option<String> = None;
        for host in &endpoints {
            match open_logged_on(host, &token, steam_id).await {
                Ok((ws, session_id, pre)) => {
                    return Ok(spawn_task(
                        ws,
                        session_id,
                        steam_id,
                        pre,
                        seed_messages,
                        seed_group_messages,
                    ))
                }
                Err(e) => last_err = Some(e),
            }
        }
        let err = last_err.unwrap_or_else(|| "no usable Steam CM endpoint".into());
        if err.contains("eresult=5") && attempt < 7 {
            tokio::time::sleep(Duration::from_secs(retry)).await;
            retry = (retry * 2).min(30);
            continue;
        }
        return Err(if err.contains("eresult=5") {
            "Steam 账号已在其他地方登录（可能残留了旧的连接，或 Steam 客户端在线）。请关闭 Steam 客户端/残留进程后重试。".to_string()
        } else {
            err
        });
    }
    Err("no usable Steam CM endpoint".into())
}

impl CmClient {
    /// Friend list merged with the latest persona/presence snapshot.
    pub async fn friends_with_personas(&self) -> Vec<(FriendState, Option<PersonaState>)> {
        let data = self.data.lock().await;
        data.friends
            .values()
            .map(|f| (f.clone(), data.personas.get(&f.steam_id).cloned()))
            .collect()
    }

    /// Latest persona for one steamid.
    pub async fn persona(&self, steam_id: u64) -> Option<PersonaState> {
        self.data.lock().await.personas.get(&steam_id).cloned()
    }

    /// Drain the buffered incoming chat messages.
    pub async fn take_messages(&self) -> Vec<IncomingChat> {
        let mut data = self.data.lock().await;
        data.messages.drain(..).collect()
    }

    /// Drain the buffered incoming group messages.
    pub async fn take_group_messages(&self) -> Vec<GroupIncoming> {
        let mut data = self.data.lock().await;
        data.group_messages.drain(..).collect()
    }

    /// Invoke a CM service method (`ChatRoom.*`, `FriendMessages.*`, …) and
    /// wait for its correlated response (15s timeout).
    pub async fn call_service(&self, method: &str, request: Vec<u8>) -> Result<Vec<u8>, String> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(Cmd::CallService {
                method: method.to_string(),
                request,
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Steam CM disconnected".to_string())?;
        let result = tokio::time::timeout(Duration::from_secs(15), reply_rx)
            .await
            .map_err(|_| "Steam CM request timed out".to_string())?
            .map_err(|_| "Steam CM disconnected".to_string())?;
        result
    }

    /// Send a text message to a friend via the `FriendMessages.SendMessage`
    /// service method.
    pub async fn send_message(&self, partner: u64, text: &str) -> Result<(), String> {
        let body = build_send_message_body(partner, text);
        self.call_service("FriendMessages.SendMessage#1", body)
            .await
            .map(|_| ())
    }

    /// Send a sticker to a friend. Steam renders the `/sticker <name>` body
    /// (chat_entry_type stays "message") as the owned sticker asset, so this is
    /// just `send_message` with the slash-command body.
    pub async fn send_sticker(&self, partner: u64, name: &str) -> Result<(), String> {
        let body = build_send_message_body(partner, &format!("/sticker {}", name));
        self.call_service("FriendMessages.SendMessage#1", body)
            .await
            .map(|_| ())
    }

    /// Fetch the account's owned sticker catalogue (`ClientEmoticonList`).
    pub async fn get_sticker_catalog(&self) -> Result<Vec<Sticker>, String> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(Cmd::GetEmoticonList { reply: reply_tx })
            .await
            .map_err(|_| "Steam CM disconnected".to_string())?;
        let result = tokio::time::timeout(Duration::from_secs(15), reply_rx)
            .await
            .map_err(|_| "Steam CM request timed out".to_string())?
            .map_err(|_| "Steam CM disconnected".to_string())?;
        result
    }

    /// Whether the background task is still alive.
    pub async fn is_alive(&self) -> bool {
        let task = self.task.lock().await;
        match task.as_ref() {
            Some(t) => !t.is_finished(),
            None => false,
        }
    }

    /// Close the connection: send `CMsgClientLogOff` so Steam releases the
    /// session, then tear the socket down. The next call reconnects on demand.
    pub async fn close(&self) {
        let task = self.task.lock().await.take();
        let _ = self.cmd_tx.send(Cmd::LogOff).await;
        if let Some(t) = task {
            let _ = tokio::time::timeout(Duration::from_secs(2), t).await;
        }
    }
}

// ── Internals ────────────────────────────────────────────────

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

async fn open_logged_on(
    host: &str,
    web_logon_token: &str,
    steam_id: u64,
) -> Result<(WsStream, u32, Vec<Envelope>), String> {
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

    let url = format!("wss://{}/cmsocket/", host);
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("CM request build failed: {}", e))?;
    // Steam's CM WebSocket expects the community chat Origin.
    request
        .headers_mut()
        .insert("Origin", "https://steamcommunity.com".parse().unwrap());
    let (ws, _) = connect_async(request)
        .await
        .map_err(|e| format!("CM connect {} failed: {}", host, e))?;
    let (mut sink, mut stream) = ws.split();

    let body = build_logon_body(web_logon_token);
    let wire = frame::encode_envelope(EMSG_CLIENT_LOGON, steam_id, 0, JOB_ID_NONE, None, &body);
    sink.send(Message::Binary(wire.into()))
        .await
        .map_err(|e| format!("CM logon send failed: {}", e))?;

    let logon = tokio::time::timeout(Duration::from_secs(10), async {
        // Envelopes that arrive alongside the logon response (Steam batches
        // the friend list / persona state right after logon) must not be
        // dropped — they are fed to the run task once it starts.
        let mut pre = Vec::new();
        loop {
            match stream.next().await {
                Some(Ok(Message::Binary(payload))) => {
                    let envelopes = frame::decode_envelopes(&payload)
                        .map_err(|e| format!("CM decode failed: {}", e))?;
                    for envelope in envelopes {
                        if envelope.emsg == EMSG_CLIENT_LOGON_RESPONSE {
                            let fields = proto_wire::parse(&envelope.body)
                                .map_err(|e| format!("logon parse: {}", e))?;
                            let eresult = proto_wire::get_varint(&fields, 1).unwrap_or(2);
                            if eresult != 1 {
                                return Err(format!("CM logon failed (eresult={})", eresult));
                            }
                            if envelope.header.session_id == 0 {
                                return Err("CM logon returned no session id".into());
                            }
                            return Ok((envelope.header.session_id, pre));
                        }
                        pre.push(envelope);
                    }
                }
                Some(Ok(_)) => {}
                Some(Err(e)) => return Err(format!("CM websocket error: {}", e)),
                None => return Err("CM websocket closed during logon".into()),
            }
        }
    })
    .await
    .map_err(|_| "CM logon timed out".to_string())??;

    // Reassemble the stream (split → merged) for the run task.
    let ws = sink
        .reunite(stream)
        .map_err(|_| "CM stream reunite failed".to_string())?;
    Ok((ws, logon.0, logon.1))
}

fn spawn_task(
    ws: WsStream,
    session_id: u32,
    steam_id: u64,
    pre: Vec<Envelope>,
    seed_messages: Vec<IncomingChat>,
    seed_group_messages: Vec<GroupIncoming>,
) -> CmClient {
    let (cmd_tx, cmd_rx) = mpsc::channel(64);
    let data = Arc::new(Mutex::new(CmData {
        session_id,
        messages: seed_messages.into(),
        group_messages: seed_group_messages.into(),
        ..Default::default()
    }));
    let data_for_task = data.clone();
    let task = tokio::spawn(async move {
        for envelope in pre {
            let _ = handle_envelope(envelope, &data_for_task).await;
        }
        run(ws, cmd_rx, data_for_task, steam_id).await;
    });
    CmClient {
        cmd_tx,
        data,
        task: Arc::new(Mutex::new(Some(task))),
    }
}

async fn run(
    mut ws: WsStream,
    mut cmd_rx: mpsc::Receiver<Cmd>,
    data: Arc<Mutex<CmData>>,
    steam_id: u64,
) {
    let mut heartbeat = tokio::time::interval(Duration::from_secs(45));
    heartbeat.tick().await; // skip the immediate first tick
    loop {
        tokio::select! {
            Some(msg) = ws.next() => {
                match msg {
                    Ok(Message::Binary(payload)) => {
                        if let Ok(envelopes) = frame::decode_envelopes(&payload) {
                            let mut failed = false;
                            for envelope in envelopes {
                                if handle_envelope(envelope, &data).await.is_err() {
                                    failed = true;
                                    break;
                                }
                            }
                            if failed { break; }
                        }
                    }
                    Ok(Message::Close(_)) => break,
                    Ok(_) => {}
                    Err(_) => break,
                }
            }
            Some(cmd) = cmd_rx.recv() => {
                match cmd {
                    Cmd::CallService { method, request, reply } => {
                        let session_id = data.lock().await.session_id;
                        let job_id = {
                            let mut d = data.lock().await;
                            d.next_job_id += 1;
                            d.next_job_id
                        };
                        let (resp_tx, resp_rx) = oneshot::channel();
                        data.lock().await.pending.insert(job_id, resp_tx);
                        let wire = frame::encode_envelope(
                            frame::EMSG_SERVICE_METHOD_CALL_FROM_CLIENT,
                            steam_id,
                            session_id,
                            job_id,
                            Some(&method),
                            &request,
                        );
                        if ws.send(Message::Binary(wire.into())).await.is_err() {
                            data.lock().await.pending.remove(&job_id);
                            let _ = reply.send(Err("Steam CM send failed".into()));
                        } else {
                            // Relay the service response to the caller.
                            tokio::spawn(async move {
                                let result = resp_rx
                                    .await
                                    .unwrap_or_else(|_| Err("Steam CM request failed".into()));
                                let _ = reply.send(result);
                            });
                        }
                    }
                    Cmd::GetEmoticonList { reply } => {
                        let session_id = data.lock().await.session_id;
                        // Drop a stale slot (a previous request that timed out)
                        // so a late response can't resolve this one prematurely.
                        let (resp_tx, resp_rx) = oneshot::channel();
                        data.lock().await.emoticon_pending = Some(resp_tx);
                        let wire = frame::encode_envelope(
                            EMSG_CLIENT_GET_EMOTICON_LIST,
                            steam_id,
                            session_id,
                            JOB_ID_NONE,
                            None,
                            &[],
                        );
                        if ws.send(Message::Binary(wire.into())).await.is_err() {
                            data.lock().await.emoticon_pending = None;
                            let _ = reply.send(Err("Steam CM send failed".into()));
                        } else {
                            tokio::spawn(async move {
                                let result = resp_rx
                                    .await
                                    .unwrap_or_else(|_| Err("Steam CM request failed".into()))
                                    .and_then(|body| parse_sticker_list(&body));
                                let _ = reply.send(result);
                            });
                        }
                    }
                    Cmd::LogOff => {
                        let session_id = data.lock().await.session_id;
                        let wire = frame::encode_envelope(
                            EMSG_CLIENT_LOG_OFF,
                            steam_id,
                            session_id,
                            JOB_ID_NONE,
                            None,
                            &[],
                        );
                        let _ = ws.send(Message::Binary(wire.into())).await;
                        break;
                    }
                }
            }
            _ = heartbeat.tick() => {
                let session_id = data.lock().await.session_id;
                let wire = frame::encode_envelope(EMSG_CLIENT_HEARTBEAT, steam_id, session_id, JOB_ID_NONE, None, &[]);
                let _ = ws.send(Message::Binary(wire.into())).await;
            }
        }
    }
}

async fn handle_envelope(envelope: Envelope, data: &Arc<Mutex<CmData>>) -> Result<(), String> {
    match envelope.emsg {
        EMSG_CLIENT_LOGGED_OFF => return Err("Steam CM logged off".into()),
        EMSG_CLIENT_FRIENDS_LIST => {
            if let Ok(list) = proto_gen::CMsgClientFriendsList::decode(envelope.body.as_slice()) {
                let mut d = data.lock().await;
                for f in list.friends {
                    if let Some(id) = f.ulfriendid {
                        d.friends.insert(
                            id,
                            FriendState {
                                steam_id: id,
                                relationship: f.efriendrelationship.unwrap_or(0),
                            },
                        );
                    }
                }
            }
        }
        EMSG_CLIENT_PERSONA_STATE => {
            if let Ok(ps) = proto_gen::CMsgClientPersonaState::decode(envelope.body.as_slice()) {
                let mut d = data.lock().await;
                for f in ps.friends {
                    if let Some(id) = f.friendid {
                        d.personas.insert(
                            id,
                            PersonaState {
                                steam_id: id,
                                persona_state: f.persona_state.unwrap_or(0),
                                player_name: f.player_name.clone(),
                                avatar_hash: f.avatar_hash.clone(),
                                game_name: f.game_name.clone(),
                                game_played_app_id: f.game_played_app_id,
                                last_logoff: f.last_logoff,
                            },
                        );
                    }
                }
            }
        }
        EMSG_SERVICE_METHOD | EMSG_SERVICE_METHOD_SEND_TO_CLIENT => {
            if let Some(name) = envelope.header.target_job_name.as_deref() {
                let method = name.split('#').next().unwrap_or(name);
                if method == "FriendMessagesClient.IncomingMessage" {
                    if let Some(chat) = parse_incoming_message(&envelope.body) {
                        data.lock().await.messages.push_back(chat);
                    }
                } else if method == "ChatRoomClient.NotifyIncomingChatMessage" {
                    if let Some(chat) = parse_incoming_group_message(&envelope.body) {
                        data.lock().await.group_messages.push_back(chat);
                    }
                }
            }
        }
        EMSG_SERVICE_METHOD_RESPONSE => {
            let job = envelope.header.job_id_target;
            if job != JOB_ID_NONE {
                let mut d = data.lock().await;
                if let Some(tx) = d.pending.remove(&job) {
                    let result = match envelope.header.transport_error {
                        Some(te) if te != 1 => Err(format!("CM transport error {}", te)),
                        _ => match envelope.header.eresult {
                            Some(er) if er != 1 => {
                                Err(format!("CM service failed (eresult={})", er))
                            }
                            _ => Ok(envelope.body),
                        },
                    };
                    let _ = tx.send(result);
                }
            }
        }
        EMSG_CLIENT_EMOTICON_LIST => {
            // Client-EMSG response matched by emsg alone (sent with JOB_ID_NONE).
            let mut d = data.lock().await;
            if let Some(tx) = d.emoticon_pending.take() {
                let _ = tx.send(Ok(envelope.body));
            }
        }
        _ => {}
    }
    Ok(())
}

fn build_logon_body(web_logon_token: &str) -> Vec<u8> {
    let mut w = Writer::new();
    w.varint(1, 65580); // protocol_version (web)
    w.varint(7, 4294966596); // client_os_type (web)
    w.varint(32, 4); // ui_mode
    w.varint(33, 2); // chat_mode
    w.string(80, "anonymous");
    w.string(103, web_logon_token);
    w.finish()
}

fn build_send_message_body(partner: u64, text: &str) -> Vec<u8> {
    // Steam clients escape literal '[' so BBCode stays intact through the CM.
    let escaped = text.replace('[', "\\[");
    let mut w = Writer::new();
    w.fixed64(1, partner);
    w.varint(2, 1); // chat_entry_type = message
    w.string(3, &escaped);
    w.bool(4, true); // contains_bbcode
    w.finish()
}

fn parse_incoming_message(body: &[u8]) -> Option<IncomingChat> {
    let fields = proto_wire::parse(body).ok()?;
    let partner = proto_wire::get_fixed64(&fields, 1)?;
    let chat_entry_type = proto_wire::get_varint(&fields, 2).unwrap_or(0) as i32;
    if chat_entry_type == 2 {
        return None; // typing indicator
    }
    let message = proto_wire::get_bytes(&fields, 4)
        .and_then(|b| String::from_utf8(b.to_vec()).ok())
        .filter(|s| !s.is_empty())
        .or_else(|| proto_wire::get_string(&fields, 8))?;
    Some(IncomingChat {
        partner_steam_id: partner,
        message,
        timestamp: proto_wire::get_fixed32(&fields, 5).unwrap_or(0),
        ordinal: proto_wire::get_varint(&fields, 6).unwrap_or(0) as u32,
        local_echo: proto_wire::get_bool(&fields, 7).unwrap_or(false),
        chat_entry_type,
    })
}

/// Parse a `ChatRoomClient.NotifyIncomingChatMessage` body into a group chat
/// message (fields 1/2 = group/chat id, 3 = sender steamid64, 4 = body,
/// 5 = timestamp, 7 = ordinal).
fn parse_incoming_group_message(body: &[u8]) -> Option<GroupIncoming> {
    let fields = proto_wire::parse(body).ok()?;
    let group_id = proto_wire::get_number(&fields, 1)?;
    let chat_id = proto_wire::get_number(&fields, 2)?;
    let sender = proto_wire::get_fixed64(&fields, 3)?;
    let message =
        proto_wire::get_string(&fields, 4).or_else(|| proto_wire::get_string(&fields, 9))?;
    if message.is_empty() {
        return None;
    }
    Some(GroupIncoming {
        group_id,
        chat_id,
        sender_steam_id: sender,
        message,
        timestamp: proto_wire::get_number(&fields, 5).unwrap_or(0) as u32,
        ordinal: proto_wire::get_number(&fields, 7).unwrap_or(0) as u32,
    })
}

/// Parse a `CMsgClientEmoticonList` body (field 2 = owned stickers). Each
/// sticker is a sub-message whose field 1 is the sticker name; the CDN asset is
/// served from `steamcommunity.com/economy/sticker/<url-encoded name>`.
fn parse_sticker_list(body: &[u8]) -> Result<Vec<Sticker>, String> {
    let fields = proto_wire::parse(body).map_err(|e| format!("emoticon list parse: {}", e))?;
    let mut stickers = Vec::new();
    for (n, value) in fields {
        if n != 2 {
            continue;
        }
        let bytes = match value {
            proto_wire::WireValue::Bytes(b) => b,
            _ => continue,
        };
        let item = proto_wire::parse(&bytes).map_err(|e| format!("sticker parse: {}", e))?;
        let name = proto_wire::get_string(&item, 1).unwrap_or_default();
        if name.trim().is_empty() {
            continue;
        }
        stickers.push(Sticker {
            name: name.clone(),
            image_url: format!(
                "https://steamcommunity.com/economy/sticker/{}",
                percent_encode_path(&name)
            ),
        });
    }
    Ok(stickers)
}

/// Percent-encode a value for use as a URL path segment (spaces → %20, etc.).
fn percent_encode_path(input: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::new();
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push(HEX[(b >> 4) as usize] as char);
                out.push(HEX[(b & 0x0F) as usize] as char);
            }
        }
    }
    out
}

/// Merge a `CMsgClientPersonaState_Friend` avatar hash into a CDN URL.
pub fn avatar_url(avatar_hash: &[u8]) -> Option<String> {
    if avatar_hash.is_empty() {
        return None;
    }
    let hex: String = avatar_hash.iter().map(|b| format!("{:02x}", b)).collect();
    let (first, rest) = hex.split_at(2);
    Some(format!(
        "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/{}/{}_{}_full.jpg",
        first, first, rest
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sticker_list() {
        // CMsgClientEmoticonList: field 2 (bytes) = sticker { name(1) = "cool_dog" }
        // and a second sticker with a name containing a space.
        let mut s1 = Writer::new();
        s1.string(1, "cool_dog");
        let s1 = s1.finish();
        let mut s2 = Writer::new();
        s2.string(1, "party parrot");
        let s2 = s2.finish();

        let mut resp = Writer::new();
        resp.bytes(2, &s1);
        resp.bytes(2, &s2);
        let body = resp.finish();

        let stickers = parse_sticker_list(&body).unwrap();
        assert_eq!(stickers.len(), 2);
        assert_eq!(stickers[0].name, "cool_dog");
        assert_eq!(
            stickers[0].image_url,
            "https://steamcommunity.com/economy/sticker/cool_dog"
        );
        assert_eq!(
            stickers[1].image_url,
            "https://steamcommunity.com/economy/sticker/party%20parrot"
        );
    }

    #[test]
    fn ignores_emoticons_field() {
        // Field 1 (emoticons) must be ignored; only field 2 (stickers) counts.
        let mut e = Writer::new();
        e.string(1, ":steam:");
        let e = e.finish();
        let mut resp = Writer::new();
        resp.bytes(1, &e);
        assert!(parse_sticker_list(&resp.finish()).unwrap().is_empty());
    }

    #[test]
    fn percent_encodes_path() {
        assert_eq!(percent_encode_path("plain"), "plain");
        assert_eq!(percent_encode_path("a b"), "a%20b");
        assert_eq!(percent_encode_path("snow/❄"), "snow%2F%E2%9D%84");
    }
}
