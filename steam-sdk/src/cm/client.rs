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

use crate::cm::bootstrap;
use crate::cm::frame::{
    self, Envelope, JOB_ID_NONE, EMSG_CLIENT_FRIENDS_LIST, EMSG_CLIENT_HEARTBEAT, EMSG_CLIENT_LOGON,
    EMSG_CLIENT_LOGON_RESPONSE, EMSG_CLIENT_LOGGED_OFF, EMSG_CLIENT_PERSONA_STATE,
    EMSG_SERVICE_METHOD, EMSG_SERVICE_METHOD_RESPONSE, EMSG_SERVICE_METHOD_SEND_TO_CLIENT,
};
use crate::cm::proto_wire::{self, Writer};
use crate::client::SteamHttpClient;
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

#[derive(Default)]
struct CmData {
    session_id: u32,
    friends: HashMap<u64, FriendState>,
    personas: HashMap<u64, PersonaState>,
    messages: VecDeque<IncomingChat>,
    next_job_id: i64,
    pending: HashMap<i64, oneshot::Sender<Result<Vec<u8>, String>>>,
}

enum Cmd {
    SendMessage {
        partner: u64,
        text: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
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
    let http = SteamHttpClient::new();
    let token = bootstrap::fetch_web_logon_token(&http, access_token, steam_id)
        .map_err(|e| format!("CM bootstrap failed: {}", e))?;
    let endpoints = bootstrap::fetch_endpoints(&http).map_err(|e| format!("CM list failed: {}", e))?;

    let mut last_err: Option<String> = None;
    for host in &endpoints {
        match open_logged_on(host, &token, steam_id).await {
            Ok((ws, session_id, pre)) => return Ok(spawn_task(ws, session_id, steam_id, pre)),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.unwrap_or_else(|| "no usable Steam CM endpoint".into()))
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

    /// Send a text message to a friend via the `FriendMessages.SendMessage`
    /// service method.
    pub async fn send_message(&self, partner: u64, text: &str) -> Result<(), String> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(Cmd::SendMessage { partner, text: text.to_string(), reply: reply_tx })
            .await
            .map_err(|_| "Steam CM disconnected".to_string())?;
        tokio::time::timeout(Duration::from_secs(15), reply_rx)
            .await
            .map_err(|_| "Steam CM request timed out".to_string())?
            .map_err(|_| "Steam CM disconnected".to_string())?
    }

    /// Whether the background task is still alive.
    pub async fn is_alive(&self) -> bool {
        let task = self.task.lock().await;
        match task.as_ref() {
            Some(t) => !t.is_finished(),
            None => false,
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
    let ws = sink.reunite(stream).map_err(|_| "CM stream reunite failed".to_string())?;
    Ok((ws, logon.0, logon.1))
}

fn spawn_task(ws: WsStream, session_id: u32, steam_id: u64, pre: Vec<Envelope>) -> CmClient {
    let (cmd_tx, cmd_rx) = mpsc::channel(64);
    let data = Arc::new(Mutex::new(CmData {
        session_id,
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

async fn run(mut ws: WsStream, mut cmd_rx: mpsc::Receiver<Cmd>, data: Arc<Mutex<CmData>>, steam_id: u64) {
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
                                if let Err(e) = handle_envelope(envelope, &data).await {
                                    log::warn!("[cm] envelope failed: {}", e);
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
                    Cmd::SendMessage { partner, text, reply } => {
                        let session_id = data.lock().await.session_id;
                        let job_id = {
                            let mut d = data.lock().await;
                            d.next_job_id += 1;
                            d.next_job_id
                        };
                        let (resp_tx, resp_rx) = oneshot::channel();
                        data.lock().await.pending.insert(job_id, resp_tx);
                        let body = build_send_message_body(partner, &text);
                        let wire = frame::encode_envelope(
                            frame::EMSG_SERVICE_METHOD_CALL_FROM_CLIENT,
                            steam_id,
                            session_id,
                            job_id,
                            Some("FriendMessages.SendMessage#1"),
                            &body,
                        );
                        if ws.send(Message::Binary(wire.into())).await.is_err() {
                            data.lock().await.pending.remove(&job_id);
                            let _ = reply.send(Err("Steam CM send failed".into()));
                        } else {
                            // Relay the service response to the caller.
                            tokio::spawn(async move {
                                let result = match resp_rx.await {
                                    Ok(Ok(_)) => Ok(()),
                                    Ok(Err(e)) => Err(e),
                                    Err(_) => Err("Steam CM request failed".into()),
                                };
                                let _ = reply.send(result);
                            });
                        }
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
                            FriendState { steam_id: id, relationship: f.efriendrelationship.unwrap_or(0) },
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
                            Some(er) if er != 1 => Err(format!("CM service failed (eresult={})", er)),
                            _ => Ok(envelope.body),
                        },
                    };
                    let _ = tx.send(result);
                }
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
