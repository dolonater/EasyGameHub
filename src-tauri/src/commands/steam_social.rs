//! Tauri commands for Steam social (friends + chat), backed by the CM
//! (Connection Manager) real-time connection.
//!
//! A single persistent CM socket per active account (held in a process-wide
//! slot) delivers friends, presence and chat; commands read its shared state
//! and issue service-method sends. Chat history is fetched via the Web API
//! service method.

use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use steam_sdk::auth::session::SessionManager;
use steam_sdk::cm::client as cm;
use steam_sdk::cm::proto_wire;
use steam_sdk::client::social;
use steam_sdk::client::social::steamid64_from_account_id;
use tauri::State;

use crate::commands::steam_api::shared_client;
use crate::commands::steam_auth::{refresh_session_if_needed, session_store_path};
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendDto {
    pub steam_id: String,
    pub persona_name: Option<String>,
    pub avatar_url: Option<String>,
    pub online_state: String,
    pub in_game_name: Option<String>,
    pub last_logoff: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageDto {
    /// Sender steamid (the account itself for outbound messages).
    pub steam_id: String,
    pub timestamp: u64,
    pub message: String,
    pub kind: String,
}

/// The active CM connection, keyed by account steamid.
static ACTIVE_CM: OnceLock<Mutex<Option<(u64, cm::CmClient)>>> = OnceLock::new();

fn active_cm() -> &'static Mutex<Option<(u64, cm::CmClient)>> {
    ACTIVE_CM.get_or_init(|| Mutex::new(None))
}

fn resolve_session(tool_dir: &Path) -> Result<(u64, String), String> {
    let session_path = session_store_path(tool_dir);
    let _ = refresh_session_if_needed(&session_path);
    let mgr = SessionManager::open(&session_path)
        .map_err(|e| format!("会话存储错误: {}", e))?;
    let session = mgr
        .active_session()
        .ok_or_else(|| "未登录 Steam，请先在 Steam 页面登录".to_string())?;
    Ok((session.steam_id, session.access_token.clone()))
}

/// Serialize CM (re)connects so concurrent commands (friend + group chat polls
/// both call `ensure_cm` every few seconds) never open duplicate connections —
/// a second logon for the same account is rejected by Steam (eresult=5).
static CONNECT_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

fn connect_lock() -> &'static tokio::sync::Mutex<()> {
    CONNECT_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

/// Reuse the live connection for this account or open a fresh one.
async fn ensure_cm(steam_id: u64, access_token: &str) -> Result<cm::CmClient, String> {
    // Fast path: reuse a live connection (no lock).
    let cached = {
        let guard = active_cm().lock().unwrap();
        guard.as_ref().map(|(sid, client)| (*sid, client.clone()))
    };
    if let Some((sid, client)) = cached {
        if sid == steam_id && client.is_alive().await {
            return Ok(client);
        }
        client.close().await;
    }

    // Serialize reconnects, then re-check (another caller may have connected).
    let _guard = connect_lock().lock().await;
    let cached = {
        let guard = active_cm().lock().unwrap();
        guard.as_ref().map(|(sid, client)| (*sid, client.clone()))
    };
    if let Some((sid, client)) = cached {
        if sid == steam_id && client.is_alive().await {
            return Ok(client);
        }
        client.close().await;
    }

    let client = cm::connect(access_token, steam_id).await?;
    let mut guard = active_cm().lock().unwrap();
    *guard = Some((steam_id, client.clone()));
    Ok(client)
}

fn online_state(personastate: i32) -> &'static str {
    match personastate {
        1 => "online",
        2 => "busy",
        3 => "away",
        4 => "snooze",
        5 => "lookingToTrade",
        6 => "lookingToPlay",
        _ => "offline",
    }
}

fn friend_dto(rel: &social::FriendRelation, s: Option<&social::UserSummary>) -> FriendDto {
    FriendDto {
        steam_id: rel.steamid.clone(),
        persona_name: s.and_then(|x| x.personaname.clone()),
        avatar_url: s.and_then(|x| x.avatarfull.clone()),
        online_state: online_state(s.and_then(|x| x.personastate).unwrap_or(0)).to_string(),
        in_game_name: s.and_then(|x| x.gameextrainfo.clone()),
        last_logoff: s.and_then(|x| x.lastlogoff).map(|v| v),
    }
}

/// Friend list + live persona/online-state, fetched via the OAuth Web API
/// (`ISteamUserOAuth/GetFriendList` + `GetUserSummaries`) — the same reliable
/// path Steam's own web chat uses (the CM pushed list is not relied upon).
#[tauri::command]
pub async fn get_friends(state: State<'_, AppState>) -> Result<Vec<FriendDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = shared_client();
    let relations = social::get_friend_list(&client, &access_token, steam_id)
        .map_err(|e| e.to_string())?;
    let friend_ids: Vec<String> = relations
        .iter()
        .filter(|r| r.relationship == "friend")
        .map(|r| r.steamid.clone())
        .collect();
    if friend_ids.is_empty() {
        return Ok(Vec::new());
    }
    let summaries = social::get_user_summaries(&client, &access_token, &friend_ids)
        .map_err(|e| e.to_string())?;
    let by_id: HashMap<String, social::UserSummary> = summaries
        .into_iter()
        .map(|s| (s.steamid.clone(), s))
        .collect();

    Ok(relations
        .into_iter()
        .filter(|r| r.relationship == "friend")
        .map(|r| friend_dto(&r, by_id.get(&r.steamid)))
        .collect())
}

/// Single friend's persona summary.
#[tauri::command]
pub async fn get_friend_profile(state: State<'_, AppState>, steam_id: String) -> Result<FriendDto, String> {
    let (_, access_token) = resolve_session(&state.tool_dir)?;
    let client = shared_client();
    let summaries = social::get_user_summaries(&client, &access_token, &[steam_id.clone()])
        .map_err(|e| e.to_string())?;
    let s = summaries.into_iter().next();
    Ok(FriendDto {
        steam_id,
        persona_name: s.as_ref().and_then(|x| x.personaname.clone()),
        avatar_url: s.as_ref().and_then(|x| x.avatarfull.clone()),
        online_state: online_state(s.as_ref().and_then(|x| x.personastate).unwrap_or(0)).to_string(),
        in_game_name: s.as_ref().and_then(|x| x.gameextrainfo.clone()),
        last_logoff: s.as_ref().and_then(|x| x.lastlogoff).map(|v| v),
    })
}

/// Drain chat messages buffered by the CM connection since the last poll.
/// Echoes of our own sends are skipped (the UI appends those optimistically).
#[tauri::command]
pub async fn poll_chat(
    state: State<'_, AppState>,
    _timeout_ms: Option<u64>,
) -> Result<Vec<ChatMessageDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(steam_id, &access_token).await?;
    let messages = client.take_messages().await;
    Ok(messages
        .into_iter()
        .filter(|m| !m.local_echo)
        .map(|m| ChatMessageDto {
            steam_id: m.partner_steam_id.to_string(),
            timestamp: m.timestamp as u64,
            message: m.message,
            kind: "saytext".into(),
        })
        .collect())
}

/// Send a text message to a friend (CM service method).
#[tauri::command]
pub async fn send_chat_message(
    state: State<'_, AppState>,
    steam_id: String,
    text: String,
) -> Result<(), String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(sid, &access_token).await?;
    let id = steam_id.parse::<u64>().map_err(|_| "invalid steam id".to_string())?;
    client.send_message(id, &text).await
}

/// Last `count` messages exchanged with a friend (Web API service method).
#[tauri::command]
pub async fn get_chat_history(
    state: State<'_, AppState>,
    steam_id: String,
    count: Option<u32>,
) -> Result<Vec<ChatMessageDto>, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let partner = steam_id.parse::<u64>().map_err(|_| "invalid steam id".to_string())?;
    let client = shared_client();
    let result = social::get_recent_messages(&client, &access_token, sid, partner, count.unwrap_or(50))
        .map_err(|e| e.to_string())?;
    Ok(result
        .messages
        .into_iter()
        .map(|m| ChatMessageDto {
            steam_id: m.sender_steamid.to_string(),
            timestamp: m.timestamp as u64,
            message: m.body,
            kind: "saytext".into(),
        })
        .collect())
}

// ── Group chat (ChatRoom service methods over CM) ────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGroupRoomDto {
    pub chat_id: String,
    pub name: String,
    pub last_message: String,
    pub last_message_timestamp: u64,
    pub last_sender_steam_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatGroupDto {
    pub group_id: String,
    pub name: String,
    pub default_chat_id: String,
    pub rooms: Vec<ChatGroupRoomDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMessageDto {
    pub group_id: String,
    pub chat_id: String,
    pub sender_steam_id: String,
    pub timestamp: u64,
    pub ordinal: u32,
    pub message: String,
}

/// Parse the `ChatRoom.GetMyChatRoomGroups` response into group summaries.
fn parse_chat_groups(body: &[u8]) -> Vec<ChatGroupDto> {
    let fields = proto_wire::parse(body).unwrap_or_default();
    let mut groups = Vec::new();
    for (_, value) in fields {
        let pair_bytes = match value {
            proto_wire::WireValue::Bytes(b) => b,
            _ => continue,
        };
        // Summary pair: field 1 = user_state, field 2 = group summary.
        let pair = proto_wire::parse(&pair_bytes).unwrap_or_default();
        let Some(summary_bytes) = proto_wire::get_bytes(&pair, 2) else {
            continue;
        };
        let summary = proto_wire::parse(summary_bytes).unwrap_or_default();
        let group_id = proto_wire::get_number(&summary, 1).unwrap_or(0);
        if group_id == 0 {
            continue;
        }
        let name = proto_wire::get_string(&summary, 2)
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Steam group".into());
        let mut default_chat_id = proto_wire::get_number(&summary, 5).unwrap_or(0);
        let mut rooms = Vec::new();
        for (n, v) in &summary {
            if *n != 6 {
                continue;
            }
            if let proto_wire::WireValue::Bytes(b) = v {
                if let Some(room) = parse_group_room(b) {
                    if default_chat_id == 0 {
                        default_chat_id = room.chat_id.parse().unwrap_or(0);
                    }
                    rooms.push(room);
                }
            }
        }
        groups.push(ChatGroupDto {
            group_id: group_id.to_string(),
            name,
            default_chat_id: default_chat_id.to_string(),
            rooms,
        });
    }
    groups
}

fn parse_group_room(bytes: &[u8]) -> Option<ChatGroupRoomDto> {
    let fields = proto_wire::parse(bytes).ok()?;
    let chat_id = proto_wire::get_number(&fields, 1)?;
    if chat_id == 0 {
        return None;
    }
    let sender = proto_wire::get_number(&fields, 8).unwrap_or(0);
    Some(ChatGroupRoomDto {
        chat_id: chat_id.to_string(),
        name: proto_wire::get_string(&fields, 2)
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Chat".into()),
        last_message: proto_wire::get_string(&fields, 7).unwrap_or_default(),
        last_message_timestamp: proto_wire::get_number(&fields, 5).unwrap_or(0),
        last_sender_steam_id: if sender > 0 {
            steamid64_from_account_id(sender).to_string()
        } else {
            String::new()
        },
    })
}

/// Parse the `ChatRoom.GetMessageHistory` response into messages.
fn parse_group_messages(group_id: &str, chat_id: &str, body: &[u8]) -> Vec<GroupMessageDto> {
    let fields = proto_wire::parse(body).unwrap_or_default();
    let mut messages = Vec::new();
    for (n, value) in fields {
        if n != 1 {
            continue;
        }
        let bytes = match value {
            proto_wire::WireValue::Bytes(b) => b,
            _ => continue,
        };
        let mf = proto_wire::parse(&bytes).unwrap_or_default();
        let sender = proto_wire::get_number(&mf, 1).unwrap_or(0);
        if sender == 0 {
            continue;
        }
        let message = proto_wire::get_string(&mf, 3).unwrap_or_default();
        if message.trim().is_empty() {
            continue;
        }
        messages.push(GroupMessageDto {
            group_id: group_id.to_string(),
            chat_id: chat_id.to_string(),
            sender_steam_id: steamid64_from_account_id(sender).to_string(),
            timestamp: proto_wire::get_number(&mf, 2).unwrap_or(0),
            ordinal: proto_wire::get_number(&mf, 4).unwrap_or(0) as u32,
            message,
        });
    }
    messages.sort_by_key(|m| (m.timestamp, m.ordinal));
    messages
}

/// List the chat room groups the account belongs to.
#[tauri::command]
pub async fn get_chat_groups(state: State<'_, AppState>) -> Result<Vec<ChatGroupDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(steam_id, &access_token).await?;
    let body = client
        .call_service("ChatRoom.GetMyChatRoomGroups#1", Vec::new())
        .await?;
    Ok(parse_chat_groups(&body))
}

/// Last messages in a group channel.
#[tauri::command]
pub async fn get_group_history(
    state: State<'_, AppState>,
    group_id: String,
    chat_id: String,
) -> Result<Vec<GroupMessageDto>, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(sid, &access_token).await?;
    let mut req = proto_wire::Writer::new();
    req.varint(1, group_id.parse::<u64>().map_err(|_| "invalid group id")?);
    req.varint(2, chat_id.parse::<u64>().map_err(|_| "invalid chat id")?);
    req.varint(7, 50);
    let body = client.call_service("ChatRoom.GetMessageHistory#1", req.finish()).await?;
    Ok(parse_group_messages(&group_id, &chat_id, &body))
}

/// Send a text message to a group channel.
#[tauri::command]
pub async fn send_group_message(
    state: State<'_, AppState>,
    group_id: String,
    chat_id: String,
    text: String,
) -> Result<(), String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(sid, &access_token).await?;
    let mut req = proto_wire::Writer::new();
    req.varint(1, group_id.parse::<u64>().map_err(|_| "invalid group id")?);
    req.varint(2, chat_id.parse::<u64>().map_err(|_| "invalid chat id")?);
    req.string(3, text.trim());
    req.bool(4, true);
    client.call_service("ChatRoom.SendChatMessage#1", req.finish()).await?;
    Ok(())
}

/// Drain group chat messages buffered by the CM connection since the last poll.
/// Echoes of our own sends are dropped — the UI appends those optimistically
/// (group chat has no `local_echo` flag like private chat).
#[tauri::command]
pub async fn poll_group_messages(state: State<'_, AppState>) -> Result<Vec<GroupMessageDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(steam_id, &access_token).await?;
    let self_id = steam_id.to_string();
    let items = client.take_group_messages().await;
    Ok(items
        .into_iter()
        .filter(|m| m.sender_steam_id.to_string() != self_id)
        .map(|m| GroupMessageDto {
            group_id: m.group_id.to_string(),
            chat_id: m.chat_id.to_string(),
            sender_steam_id: m.sender_steam_id.to_string(),
            timestamp: m.timestamp as u64,
            ordinal: m.ordinal,
            message: m.message,
        })
        .collect())
}
