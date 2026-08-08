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
use steam_sdk::client::social;
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

/// Reuse the live connection for this account or open a fresh one.
async fn ensure_cm(steam_id: u64, access_token: &str) -> Result<cm::CmClient, String> {
    // Fast path: clone out the cached handle and drop the lock before awaiting.
    let cached = {
        let guard = active_cm().lock().unwrap();
        guard.as_ref().map(|(sid, client)| (*sid, client.clone()))
    };
    if let Some((sid, client)) = cached {
        if sid == steam_id && client.is_alive().await {
            return Ok(client);
        }
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
    log::info!(
        "[social] get_friends: {} relations, {} friends",
        relations.len(),
        friend_ids.len()
    );
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
