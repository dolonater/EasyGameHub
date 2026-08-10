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
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use steam_sdk::cm::client as cm;
use steam_sdk::cm::proto_wire;
use steam_sdk::client::social;
use steam_sdk::client::social::steamid64_from_account_id;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::core::social_cache::{
    append_friend_incoming, append_group_incoming, bound_thread, correlate_friend_echo,
    new_local_id, merge_friend_thread, merge_group_thread, recover_friend_states,
    recover_group_states, CachedMessage, ChatSessionEntry, ChatSessionsSnapshot, DeliveryState,
    FriendCacheEntry, FriendThreadSnapshot, FriendsSnapshot, GroupCacheEntry, GroupRoomCacheEntry,
    GroupsSnapshot, GroupThreadSnapshot, ServerMsg, SocialCache,
};
use crate::commands::steam_api::shared_client;
use crate::commands::steam_auth;
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
    /// `sent` / `pending` / `verifying` / `failedRetryable` (see `DeliveryState`).
    pub delivery_state: String,
}

/// A private-chat thread returned by `open_chat` / `refresh_chat`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatThreadDto {
    pub messages: Vec<ChatMessageDto>,
    pub more_available: bool,
}

/// One recent-conversation summary (from `load_sessions` / `refresh_sessions`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionDto {
    pub partner_steam_id: String,
    pub last_message: String,
    pub last_timestamp: u64,
    pub unread_count: u32,
}

/// One owned Steam sticker (from `get_sticker_catalog`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StickerDto {
    pub name: String,
    pub image_url: String,
}

/// The active CM connection, keyed by account steamid.
static ACTIVE_CM: OnceLock<Mutex<Option<(u64, cm::CmClient)>>> = OnceLock::new();

fn active_cm() -> &'static Mutex<Option<(u64, cm::CmClient)>> {
    ACTIVE_CM.get_or_init(|| Mutex::new(None))
}

/// The thread currently open in the UI (reported via `set_active_thread`). The
/// background poller reads this to suppress the unread bump for the active
/// conversation — otherwise messages you're already looking at would badge up.
#[derive(Debug, Clone)]
struct ActiveThread {
    partner: Option<String>,
    group: Option<(String, String)>,
}

static ACTIVE_THREAD: OnceLock<Mutex<Option<ActiveThread>>> = OnceLock::new();

fn active_thread() -> &'static Mutex<Option<ActiveThread>> {
    ACTIVE_THREAD.get_or_init(|| Mutex::new(None))
}

/// Report which thread is currently open in the UI. Both `partner` and `group`
/// cleared = no active thread (every incoming message counts as unread).
#[tauri::command]
pub fn set_active_thread(
    partner: Option<String>,
    group: Option<(String, String)>,
) -> Result<(), String> {
    *active_thread().lock().unwrap() = Some(ActiveThread { partner, group });
    Ok(())
}

// ── Background poller (event-driven push) ────────────────────
//
// A single long-lived task drains the CM connection's message buffers once a
// second, writes them through to the per-account cache (the same helpers the
// poll commands use), and emits `social:chat` / `social:group` Tauri events so
// the frontend receives messages instantly instead of polling every 3s.
//
// It never *opens* a connection itself — if no live CM client exists (the user
// hasn't opened the social page yet, or the connection dropped) it idles.
// Opening stays in `ensure_cm`, keeping the reconnect/cooldown logic in one
// place and avoiding a competing logon at startup.

pub fn start_social_poller(app: &AppHandle) {
    let tool_dir = app.state::<AppState>().tool_dir.clone();
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(1));
        loop {
            ticker.tick().await;
            drain_and_emit(&tool_dir, &app).await;
        }
    });
}

async fn drain_and_emit(tool_dir: &Path, app: &AppHandle) {
    let Some((steam_id, client)) = active_client() else {
        return;
    };
    if !client.is_alive().await {
        return;
    }
    let chat = client.take_messages().await;
    let group = client.take_group_messages().await;
    if chat.is_empty() && group.is_empty() {
        return;
    }

    let account = steam_id.to_string();
    let active = active_thread()
        .lock()
        .unwrap()
        .clone()
        .unwrap_or(ActiveThread {
            partner: None,
            group: None,
        });

    // Write-through is best-effort: a missing/corrupt store (or a store written
    // by a different user) only skips persistence — the events still fire so the
    // UI never loses a message. Matches the poll commands' behavior.
    let _guard = social_cache_lock().lock().await;
    if let Some(mut cache) = open_cache(tool_dir, steam_id) {
        let active_partner = active.partner.as_deref().unwrap_or("");
        process_friend_incoming(&mut cache, &account, &chat, active_partner).await;
        let active_group = active.group.as_ref().map(|(g, c)| (g.as_str(), c.as_str()));
        process_group_incoming(&mut cache, &account, &account, &group, active_group).await;
    }
    drop(_guard);

    if !chat.is_empty() {
        let payload: Vec<ChatMessageDto> = chat
            .iter()
            .filter(|m| !m.local_echo)
            .map(incoming_to_chat_dto)
            .collect();
        let _ = app.emit("social:chat", payload);
    }
    if !group.is_empty() {
        let payload: Vec<GroupMessageDto> = group
            .iter()
            .filter(|m| m.sender_steam_id.to_string() != account)
            .map(group_incoming_to_dto)
            .collect();
        let _ = app.emit("social:group", payload);
    }
}

/// Resolve the active session's `(steam_id, access_token)`. Served from the
/// in-memory cache in `steam_auth` when fresh, falling back to the full open +
/// refresh path (see `resolve_session_cached`).
fn resolve_session(tool_dir: &Path) -> Result<(u64, String), String> {
    steam_auth::resolve_session_cached(tool_dir)
}

/// Serialize CM (re)connects so concurrent commands (friend + group chat polls
/// both call `ensure_cm` every few seconds) never open duplicate connections —
/// a second logon for the same account is rejected by Steam (eresult=5).
static CONNECT_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

fn connect_lock() -> &'static tokio::sync::Mutex<()> {
    CONNECT_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

/// Cooldown after a failed connect: while Steam is releasing a stale session
/// (eresult=5, exponential backoff up to ~90s), every 3s poll would otherwise
/// queue behind the lock and each queue its own reconnect (N polls × 90s).
/// Within the window we fail fast instead, then allow one retry.
static CM_CONNECT_COOLDOWN: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
const CM_CONNECT_COOLDOWN_SECS: u64 = 30;
const CM_COOLDOWN_MESSAGE: &str = "Steam CM 连接暂不可用，请稍后再试";

fn cm_in_cooldown() -> bool {
    cm_connect_cooldown()
        .lock()
        .unwrap()
        .as_ref()
        .map(|failed_at| failed_at.elapsed() < Duration::from_secs(CM_CONNECT_COOLDOWN_SECS))
        .unwrap_or(false)
}

fn cm_connect_cooldown() -> &'static Mutex<Option<Instant>> {
    CM_CONNECT_COOLDOWN.get_or_init(|| Mutex::new(None))
}

/// Serialize cache read-modify-write: several commands (friend + group polls,
/// open/refresh, sends) run every few seconds and reopen the per-account
/// SecureStore file on each call.
static SOCIAL_CACHE_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

fn social_cache_lock() -> &'static tokio::sync::Mutex<()> {
    SOCIAL_CACHE_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Best-effort per-account cache open: any store problem (tampered file, a
/// store written by a different user) just means "no cache".
fn open_cache(tool_dir: &Path, steam_id: u64) -> Option<SocialCache> {
    SocialCache::open(tool_dir, steam_id).ok()
}

/// Open the cache with a per-account file path (helper to keep the many
/// `thread|<partner>` constructions in one place).
fn empty_friend_thread(account: &str, partner: &str) -> FriendThreadSnapshot {
    FriendThreadSnapshot {
        account_steam_id: account.to_string(),
        partner_steam_id: partner.to_string(),
        messages: Vec::new(),
        more_available: false,
        fetched_at: 0,
        unread_count: 0,
    }
}

fn empty_group_thread(account: &str, group_id: &str, chat_id: &str) -> GroupThreadSnapshot {
    GroupThreadSnapshot {
        account_steam_id: account.to_string(),
        group_id: group_id.to_string(),
        chat_id: chat_id.to_string(),
        messages: Vec::new(),
        more_available: false,
        fetched_at: 0,
        unread_count: 0,
    }
}

fn cached_msg_to_group_dto(group_id: &str, chat_id: &str, m: &CachedMessage) -> GroupMessageDto {
    GroupMessageDto {
        group_id: group_id.to_string(),
        chat_id: chat_id.to_string(),
        sender_steam_id: m.sender_steam_id.clone(),
        timestamp: m.timestamp,
        ordinal: m.ordinal,
        message: m.body.clone(),
        delivery_state: m.delivery_state.to_dto_str().to_string(),
    }
}

fn chat_group_dto_to_cache_entry(d: &ChatGroupDto) -> GroupCacheEntry {
    GroupCacheEntry {
        group_id: d.group_id.clone(),
        name: d.name.clone(),
        default_chat_id: d.default_chat_id.clone(),
        rooms: d
            .rooms
            .iter()
            .map(|r| GroupRoomCacheEntry {
                chat_id: r.chat_id.clone(),
                name: r.name.clone(),
                last_message: r.last_message.clone(),
                last_message_timestamp: r.last_message_timestamp,
                last_sender_steam_id: r.last_sender_steam_id.clone(),
            })
            .collect(),
    }
}

fn cache_entry_to_chat_group_dto(e: GroupCacheEntry) -> ChatGroupDto {
    ChatGroupDto {
        group_id: e.group_id,
        name: e.name,
        default_chat_id: e.default_chat_id,
        rooms: e
            .rooms
            .into_iter()
            .map(|r| ChatGroupRoomDto {
                chat_id: r.chat_id,
                name: r.name,
                last_message: r.last_message,
                last_message_timestamp: r.last_message_timestamp,
                last_sender_steam_id: r.last_sender_steam_id,
                unread_count: 0, // filled in by `augment_group_unread`
            })
            .collect(),
    }
}

/// Fill each room's `unread_count` from its cached group-thread snapshot (the
/// CM group summary carries no unread). The caller must hold the cache lock.
fn augment_group_unread(
    cache: &SocialCache,
    account: &str,
    mut groups: Vec<ChatGroupDto>,
) -> Vec<ChatGroupDto> {
    for g in &mut groups {
        for room in &mut g.rooms {
            room.unread_count = cache
                .load_group_thread(account, &g.group_id, &room.chat_id)
                .map(|t| t.unread_count)
                .unwrap_or(0);
        }
    }
    groups
}

/// Snapshot of the current connection slot, if any.
fn active_client() -> Option<(u64, cm::CmClient)> {
    let guard = active_cm().lock().unwrap();
    guard.as_ref().map(|(sid, client)| (*sid, client.clone()))
}

/// Reuse the live connection for this account or open a fresh one.
async fn ensure_cm(steam_id: u64, access_token: &str) -> Result<cm::CmClient, String> {
    // Fast path: reuse a live connection (no lock) — always wins, even if a
    // stale cooldown flag is set.
    if let Some((sid, client)) = active_client() {
        if sid == steam_id && client.is_alive().await {
            return Ok(client);
        }
    }

    // Fail fast while a recent connect failure is cooling down (no lock) —
    // otherwise every 3s poll piles a new reconnect attempt behind the slow
    // eresult=5 backoff.
    if cm_in_cooldown() {
        return Err(CM_COOLDOWN_MESSAGE.into());
    }

    // Serialize reconnects, then re-check (another caller may have connected).
    let _guard = connect_lock().lock().await;
    if let Some((sid, client)) = active_client() {
        if sid == steam_id && client.is_alive().await {
            return Ok(client);
        }
    }
    if cm_in_cooldown() {
        return Err(CM_COOLDOWN_MESSAGE.into());
    }

    // Drain the stale same-account connection's buffered messages so the
    // replacement session doesn't lose messages that arrived since the last
    // poll (Steam doesn't replay chat after a reconnect). Account switches
    // never carry messages over. Either way the stale connection is closed.
    let (seed_messages, seed_group_messages) = match active_client() {
        Some((sid, client)) if sid == steam_id => {
            let seed = (client.take_messages().await, client.take_group_messages().await);
            client.close().await;
            seed
        }
        Some((_, client)) => {
            client.close().await;
            (Vec::new(), Vec::new())
        }
        None => (Vec::new(), Vec::new()),
    };

    let result = cm::connect_with_seed(
        access_token,
        steam_id,
        seed_messages,
        seed_group_messages,
    )
    .await;
    let client = match result {
        Ok(client) => {
            *cm_connect_cooldown().lock().unwrap() = None;
            client
        }
        Err(e) => {
            *cm_connect_cooldown().lock().unwrap() = Some(Instant::now());
            let mut guard = active_cm().lock().unwrap();
            *guard = None;
            return Err(e);
        }
    };
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

fn friend_dto_to_cache_entry(d: &FriendDto) -> FriendCacheEntry {
    FriendCacheEntry {
        steam_id: d.steam_id.clone(),
        persona_name: d.persona_name.clone(),
        avatar_url: d.avatar_url.clone(),
        online_state: d.online_state.clone(),
        in_game_name: d.in_game_name.clone(),
        last_logoff: d.last_logoff,
    }
}

fn cache_entry_to_friend_dto(e: FriendCacheEntry) -> FriendDto {
    FriendDto {
        steam_id: e.steam_id,
        persona_name: e.persona_name,
        avatar_url: e.avatar_url,
        online_state: e.online_state,
        in_game_name: e.in_game_name,
        last_logoff: e.last_logoff,
    }
}

fn cached_msg_to_chat_dto(m: &CachedMessage) -> ChatMessageDto {
    ChatMessageDto {
        steam_id: m.sender_steam_id.clone(),
        timestamp: m.timestamp,
        message: m.body.clone(),
        kind: "saytext".into(),
        delivery_state: m.delivery_state.to_dto_str().to_string(),
    }
}

/// Map a drained CM incoming chat message to its DTO. Shared by the background
/// poller (its `social:chat` event payload).
fn incoming_to_chat_dto(m: &cm::IncomingChat) -> ChatMessageDto {
    ChatMessageDto {
        steam_id: m.partner_steam_id.to_string(),
        timestamp: m.timestamp as u64,
        message: m.message.clone(),
        kind: "saytext".into(),
        delivery_state: "sent".into(),
    }
}

/// Map a drained CM incoming group message to its DTO. Shared by the background
/// poller (its `social:group` event payload).
fn group_incoming_to_dto(m: &cm::GroupIncoming) -> GroupMessageDto {
    GroupMessageDto {
        group_id: m.group_id.to_string(),
        chat_id: m.chat_id.to_string(),
        sender_steam_id: m.sender_steam_id.to_string(),
        timestamp: m.timestamp as u64,
        ordinal: m.ordinal,
        message: m.message.clone(),
        delivery_state: "sent".into(),
    }
}

/// Write-through drained friend messages into the per-account cache: correlate
/// echoes of our own sends (adopting the server identity), append real incoming
/// (unread unless `active_partner` matches), and bound each thread. The caller
/// must hold the cache lock.
async fn process_friend_incoming(
    cache: &mut SocialCache,
    account: &str,
    messages: &[cm::IncomingChat],
    active_partner: &str,
) {
    for m in messages {
        if m.local_echo {
            let partner = m.partner_steam_id.to_string();
            if let Some(mut thread) = cache.load_friend_thread(account, &partner) {
                if correlate_friend_echo(&mut thread, &m.message, m.timestamp as u64, m.ordinal)
                {
                    let (bounded, _) = bound_thread(thread.messages);
                    thread.messages = bounded;
                    cache.save_friend_thread(&thread);
                }
            }
        } else {
            let partner = m.partner_steam_id.to_string();
            let mut thread = cache
                .load_friend_thread(account, &partner)
                .unwrap_or_else(|| empty_friend_thread(account, &partner));
            append_friend_incoming(
                &mut thread,
                ServerMsg {
                    timestamp: m.timestamp as u64,
                    ordinal: m.ordinal,
                    sender_steam_id: partner.clone(),
                    body: m.message.clone(),
                },
                active_partner,
            );
            let (bounded, _) = bound_thread(thread.messages);
            thread.messages = bounded;
            cache.save_friend_thread(&thread);
        }
    }
}

/// Write-through drained group messages into the per-account cache: skip our
/// own sends (already persisted by `send_group_message`), append real incoming
/// (unread unless `active_group` matches), and bound each thread. The caller
/// must hold the cache lock.
async fn process_group_incoming(
    cache: &mut SocialCache,
    account: &str,
    self_id: &str,
    items: &[cm::GroupIncoming],
    active_group: Option<(&str, &str)>,
) {
    for m in items {
        if m.sender_steam_id.to_string() == self_id {
            continue;
        }
        let gid = m.group_id.to_string();
        let cid = m.chat_id.to_string();
        let mut thread = cache
            .load_group_thread(account, &gid, &cid)
            .unwrap_or_else(|| empty_group_thread(account, &gid, &cid));
        append_group_incoming(
            &mut thread,
            ServerMsg {
                timestamp: m.timestamp as u64,
                ordinal: m.ordinal,
                sender_steam_id: m.sender_steam_id.to_string(),
                body: m.message.clone(),
            },
            active_group,
        );
        let (bounded, _) = bound_thread(thread.messages);
        thread.messages = bounded;
        cache.save_group_thread(&thread);
    }
}

/// Load the friends snapshot from the per-account cache (instant; empty when
/// absent). Network refresh is a separate `refresh_friends` call.
#[tauri::command]
pub async fn load_friends(state: State<'_, AppState>) -> Result<Vec<FriendDto>, String> {
    let (steam_id, _) = resolve_session(&state.tool_dir)?;
    let account = steam_id.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(cache) = open_cache(&state.tool_dir, steam_id) else {
        return Ok(Vec::new());
    };
    let snapshot = cache.load_friends(&account);
    Ok(snapshot
        .map(|s| s.friends.into_iter().map(cache_entry_to_friend_dto).collect())
        .unwrap_or_default())
}

/// Fetch the friend list + live persona/online-state (OAuth Web API — the same
/// reliable path Steam's own web chat uses) and persist it to the cache.
#[tauri::command]
pub async fn refresh_friends(state: State<'_, AppState>) -> Result<Vec<FriendDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = shared_client();
    let relations = social::get_friend_list(&client, &access_token, steam_id)
        .map_err(|e| e.to_string())?;
    let friend_ids: Vec<String> = relations
        .iter()
        .filter(|r| r.relationship == "friend")
        .map(|r| r.steamid.clone())
        .collect();
    let by_id: HashMap<String, social::UserSummary> = if friend_ids.is_empty() {
        HashMap::new()
    } else {
        let summaries = social::get_user_summaries(&client, &access_token, &friend_ids)
            .map_err(|e| e.to_string())?;
        summaries.into_iter().map(|s| (s.steamid.clone(), s)).collect()
    };

    let dtos: Vec<FriendDto> = relations
        .into_iter()
        .filter(|r| r.relationship == "friend")
        .map(|r| friend_dto(&r, by_id.get(&r.steamid)))
        .collect();

    let account = steam_id.to_string();
    let snapshot = FriendsSnapshot {
        account_steam_id: account,
        friends: dtos.iter().map(friend_dto_to_cache_entry).collect(),
        fetched_at: now_unix(),
    };
    let _guard = social_cache_lock().lock().await;
    if let Some(mut cache) = open_cache(&state.tool_dir, steam_id) {
        cache.save_friends(&snapshot);
    }
    Ok(dtos)
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

/// Send a text message to a friend (CM service method). The message is
/// persisted to the thread cache as `pending` on success (the CM echo later
/// correlates it to its server identity) or `failedRetryable` on failure, so
/// it survives a restart and can be retried.
#[tauri::command]
pub async fn send_chat_message(
    state: State<'_, AppState>,
    steam_id: String,
    text: String,
) -> Result<ChatMessageDto, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let partner = steam_id.parse::<u64>().map_err(|_| "invalid steam id".to_string())?;
    let client = ensure_cm(sid, &access_token).await?;
    let account = sid.to_string();
    let body = text.trim().to_string();
    if body.is_empty() {
        return Err("消息不能为空".to_string());
    }
    let local = CachedMessage {
        local_id: Some(new_local_id()),
        timestamp: now_unix(),
        ordinal: 0,
        sender_steam_id: account.clone(),
        body: body.clone(),
        delivery_state: DeliveryState::Pending,
    };

    match client.send_message(partner, &body).await {
        Ok(()) => {
            let dto = cached_msg_to_chat_dto(&local);
            let _guard = social_cache_lock().lock().await;
            if let Some(mut cache) = open_cache(&state.tool_dir, sid) {
                let mut thread = cache
                    .load_friend_thread(&account, &steam_id)
                    .unwrap_or_else(|| empty_friend_thread(&account, &steam_id));
                thread.messages.push(local);
                let (bounded, _) = bound_thread(thread.messages);
                thread.messages = bounded;
                cache.save_friend_thread(&thread);
            }
            Ok(dto)
        }
        Err(e) => {
            let mut failed = local;
            failed.delivery_state = DeliveryState::FailedRetryable;
            let _guard = social_cache_lock().lock().await;
            if let Some(mut cache) = open_cache(&state.tool_dir, sid) {
                let mut thread = cache
                    .load_friend_thread(&account, &steam_id)
                    .unwrap_or_else(|| empty_friend_thread(&account, &steam_id));
                thread.messages.push(failed);
                let (bounded, _) = bound_thread(thread.messages);
                thread.messages = bounded;
                cache.save_friend_thread(&thread);
            }
            Err(e)
        }
    }
}

/// Read a friend thread from the cache (instant, offline-safe) and mark the
/// conversation read. Stored `pending` messages are reported as `verifying`
/// (the app re-checks them against server history via `refresh_chat`).
#[tauri::command]
pub async fn open_chat(
    state: State<'_, AppState>,
    steam_id: String,
) -> Result<ChatThreadDto, String> {
    let (sid, _) = resolve_session(&state.tool_dir)?;
    let account = sid.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(mut cache) = open_cache(&state.tool_dir, sid) else {
        return Ok(ChatThreadDto { messages: Vec::new(), more_available: false });
    };
    let (messages, more_available) = match cache.load_friend_thread(&account, &steam_id) {
        Some(mut snap) => {
            if snap.unread_count != 0 {
                snap.unread_count = 0;
                cache.save_friend_thread(&snap);
            }
            (recover_friend_states(&snap.messages), snap.more_available)
        }
        None => (Vec::new(), false),
    };
    Ok(ChatThreadDto {
        messages: messages.iter().map(cached_msg_to_chat_dto).collect(),
        more_available,
    })
}

/// Fetch recent friend-chat history (Web API service method), merge it with the
/// cached thread (dedupe by identity + reconcile optimistic sends), bound and
/// persist it, then return the reconciled thread.
///
/// `older_than` (a unix timestamp) pages **backward**: Steam returns the 50
/// messages ending just before it, so scrolling up can load history older than
/// the cached thread. The frontend passes its oldest displayed message's time.
#[tauri::command]
pub async fn refresh_chat(
    state: State<'_, AppState>,
    steam_id: String,
    older_than: Option<u64>,
) -> Result<ChatThreadDto, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let partner = steam_id.parse::<u64>().map_err(|_| "invalid steam id".to_string())?;
    let account = sid.to_string();
    let client = shared_client();
    let result = social::get_recent_messages(
        &client,
        &access_token,
        sid,
        partner,
        50,
        older_than.map(|ts| (ts as u32, 0)),
    )
    .map_err(|e| e.to_string())?;
    // Server-authoritative "more history" flag (response field 4) plus the
    // full-page heuristic drive the "load older" affordance.
    let server_more = result.more_available;
    let server: Vec<ServerMsg> = result
        .messages
        .into_iter()
        .map(|m| ServerMsg {
            timestamp: m.timestamp as u64,
            ordinal: 0,
            sender_steam_id: m.sender_steamid.to_string(),
            body: m.body,
        })
        .collect();
    let server_full_page = server.len() >= 50;

    let _guard = social_cache_lock().lock().await;
    let Some(mut cache) = open_cache(&state.tool_dir, sid) else {
        // No cache store — still return the fresh server history.
        let msgs: Vec<ChatMessageDto> = server
            .iter()
            .map(|m| ChatMessageDto {
                steam_id: m.sender_steam_id.clone(),
                timestamp: m.timestamp,
                message: m.body.clone(),
                kind: "saytext".into(),
                delivery_state: "sent".into(),
            })
            .collect();
        return Ok(ChatThreadDto { messages: msgs, more_available: false });
    };
    let cached = cache.load_friend_thread(&account, &steam_id);
    // Preserve the cached unread: only `open_chat` (the explicit "user opened
    // this") clears it. Forcing 0 here could wipe an unread bump that arrived
    // while this refresh was in flight.
    let prev_unread = cached.as_ref().map(|s| s.unread_count).unwrap_or(0);
    let cached_msgs = cached.map(|s| s.messages).unwrap_or_default();
    let merged = merge_friend_thread(cached_msgs, server, &account, now_unix());
    let (bounded, trimmed) = bound_thread(merged);
    let snapshot = FriendThreadSnapshot {
        account_steam_id: account.clone(),
        partner_steam_id: steam_id.clone(),
        messages: bounded,
        // More history when the server says so, we trimmed the cache bound, or
        // the fetch returned a full page (so an older page likely exists).
        more_available: trimmed || server_more || server_full_page,
        fetched_at: now_unix(),
        unread_count: prev_unread,
    };
    cache.save_friend_thread(&snapshot);
    Ok(ChatThreadDto {
        messages: recover_friend_states(&snapshot.messages)
            .iter()
            .map(cached_msg_to_chat_dto)
            .collect(),
        more_available: snapshot.more_available,
    })
}

// ── Sessions (recent conversations + unread) ──────────────────

fn cache_entry_to_session_dto(e: ChatSessionEntry) -> ChatSessionDto {
    ChatSessionDto {
        partner_steam_id: e.partner_steam_id,
        last_message: e.last_message,
        last_timestamp: e.last_timestamp,
        unread_count: e.unread_count,
    }
}

/// Cached recent-conversation summaries (instant; empty when nothing cached).
#[tauri::command]
pub async fn load_sessions(state: State<'_, AppState>) -> Result<Vec<ChatSessionDto>, String> {
    let (steam_id, _) = resolve_session(&state.tool_dir)?;
    let account = steam_id.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(cache) = open_cache(&state.tool_dir, steam_id) else {
        return Ok(Vec::new());
    };
    let snapshot = cache.load_sessions(&account);
    Ok(snapshot
        .map(|s| s.sessions.into_iter().map(cache_entry_to_session_dto).collect())
        .unwrap_or_default())
}

/// Derive the recent-conversation list from the cached friends snapshot + each
/// friend thread (last message preview + unread count), newest-activity first,
/// and persist it.
#[tauri::command]
pub async fn refresh_sessions(state: State<'_, AppState>) -> Result<Vec<ChatSessionDto>, String> {
    let (steam_id, _) = resolve_session(&state.tool_dir)?;
    let account = steam_id.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(mut cache) = open_cache(&state.tool_dir, steam_id) else {
        return Ok(Vec::new());
    };
    let friends = cache
        .load_friends(&account)
        .map(|s| s.friends)
        .unwrap_or_default();
    let mut sessions: Vec<ChatSessionEntry> = Vec::with_capacity(friends.len());
    for f in &friends {
        let thread = cache.load_friend_thread(&account, &f.steam_id);
        let (last_message, last_timestamp, unread_count) = match &thread {
            Some(t) => {
                let tail = t.messages.last();
                (
                    tail.map(|m| m.body.clone()).unwrap_or_default(),
                    tail.map(|m| m.timestamp).unwrap_or(0),
                    t.unread_count,
                )
            }
            None => (String::new(), 0, 0),
        };
        sessions.push(ChatSessionEntry {
            partner_steam_id: f.steam_id.clone(),
            last_message,
            last_timestamp,
            unread_count,
        });
    }
    sessions.sort_by_key(|s| std::cmp::Reverse(s.last_timestamp));
    let snapshot = ChatSessionsSnapshot {
        account_steam_id: account,
        sessions,
        fetched_at: now_unix(),
    };
    cache.save_sessions(&snapshot);
    Ok(snapshot
        .sessions
        .into_iter()
        .map(cache_entry_to_session_dto)
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
    /// Unread messages in this channel (from its cached thread snapshot).
    pub unread_count: u32,
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
    /// `sent` / `pending` / `verifying` / `failedRetryable` (see `DeliveryState`).
    pub delivery_state: String,
}

/// A group-channel thread returned by `open_group_chat` / `refresh_group_chat`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupThreadDto {
    pub messages: Vec<GroupMessageDto>,
    pub more_available: bool,
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
        unread_count: 0, // filled in by `augment_group_unread`
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
            delivery_state: "sent".into(),
        });
    }
    messages.sort_by_key(|m| (m.timestamp, m.ordinal));
    messages
}

/// Cached chat room groups (instant; empty when nothing cached yet).
#[tauri::command]
pub async fn load_groups(state: State<'_, AppState>) -> Result<Vec<ChatGroupDto>, String> {
    let (steam_id, _) = resolve_session(&state.tool_dir)?;
    let account = steam_id.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(cache) = open_cache(&state.tool_dir, steam_id) else {
        return Ok(Vec::new());
    };
    let snapshot = cache.load_groups(&account);
    let dtos: Vec<ChatGroupDto> = snapshot
        .map(|s| s.groups.into_iter().map(cache_entry_to_chat_group_dto).collect())
        .unwrap_or_default();
    Ok(augment_group_unread(&cache, &account, dtos))
}

/// Fresh list of the chat room groups the account belongs to (CM service
/// method), persisted to the cache.
#[tauri::command]
pub async fn refresh_groups(state: State<'_, AppState>) -> Result<Vec<ChatGroupDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(steam_id, &access_token).await?;
    let body = client
        .call_service("ChatRoom.GetMyChatRoomGroups#1", Vec::new())
        .await?;
    let dtos = parse_chat_groups(&body);
    let account = steam_id.to_string();
    let snapshot = GroupsSnapshot {
        account_steam_id: account.clone(),
        groups: dtos.iter().map(chat_group_dto_to_cache_entry).collect(),
        fetched_at: now_unix(),
    };
    let _guard = social_cache_lock().lock().await;
    let augmented = match open_cache(&state.tool_dir, steam_id) {
        Some(mut cache) => {
            cache.save_groups(&snapshot);
            augment_group_unread(&cache, &account, dtos)
        }
        None => dtos,
    };
    Ok(augmented)
}

/// Read a group-channel thread from the cache (instant, offline-safe) and mark
/// the channel read. Stored non-`sent` messages are reported as
/// `failedRetryable` (they can be re-sent).
#[tauri::command]
pub async fn open_group_chat(
    state: State<'_, AppState>,
    group_id: String,
    chat_id: String,
) -> Result<GroupThreadDto, String> {
    let (sid, _) = resolve_session(&state.tool_dir)?;
    let account = sid.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(mut cache) = open_cache(&state.tool_dir, sid) else {
        return Ok(GroupThreadDto { messages: Vec::new(), more_available: false });
    };
    let (messages, more_available) = match cache.load_group_thread(&account, &group_id, &chat_id) {
        Some(mut snap) => {
            if snap.unread_count != 0 {
                snap.unread_count = 0;
                cache.save_group_thread(&snap);
            }
            (recover_group_states(&snap.messages), snap.more_available)
        }
        None => (Vec::new(), false),
    };
    Ok(GroupThreadDto {
        messages: messages
            .iter()
            .map(|m| cached_msg_to_group_dto(&group_id, &chat_id, m))
            .collect(),
        more_available,
    })
}

/// Fetch recent group-channel history (CM service method), merge it with the
/// cached thread, bound and persist it, then return the reconciled thread.
///
/// `older_than` (a unix timestamp) pages backward: `GetMessageHistory` field 5
/// (`start_time`) returns messages at/before it, so scrolling up can load older
/// history. The frontend passes its oldest displayed message's time.
#[tauri::command]
pub async fn refresh_group_chat(
    state: State<'_, AppState>,
    group_id: String,
    chat_id: String,
    older_than: Option<u64>,
) -> Result<GroupThreadDto, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(sid, &access_token).await?;
    let mut req = proto_wire::Writer::new();
    req.varint(1, group_id.parse::<u64>().map_err(|_| "invalid group id")?);
    req.varint(2, chat_id.parse::<u64>().map_err(|_| "invalid chat id")?);
    if let Some(ts) = older_than {
        req.varint(5, ts); // start_time (backward-paging boundary)
    }
    req.varint(7, 50); // max_count
    let body = client
        .call_service("ChatRoom.GetMessageHistory#1", req.finish())
        .await?;
    let parsed_msgs = parse_group_messages(&group_id, &chat_id, &body);
    let server_full_page = parsed_msgs.len() >= 50;
    // Server-authoritative "more history" flag (response field 4).
    let server_more = proto_wire::get_bool(&proto_wire::parse(&body).unwrap_or_default(), 4)
        .unwrap_or(false);
    let server: Vec<ServerMsg> = parsed_msgs
        .into_iter()
        .map(|m| ServerMsg {
            timestamp: m.timestamp,
            ordinal: m.ordinal,
            sender_steam_id: m.sender_steam_id,
            body: m.message,
        })
        .collect();

    let account = sid.to_string();
    let _guard = social_cache_lock().lock().await;
    let Some(mut cache) = open_cache(&state.tool_dir, sid) else {
        let msgs: Vec<GroupMessageDto> = server
            .iter()
            .map(|m| GroupMessageDto {
                group_id: group_id.clone(),
                chat_id: chat_id.clone(),
                sender_steam_id: m.sender_steam_id.clone(),
                timestamp: m.timestamp,
                ordinal: m.ordinal,
                message: m.body.clone(),
                delivery_state: "sent".into(),
            })
            .collect();
        return Ok(GroupThreadDto { messages: msgs, more_available: false });
    };
    let cached = cache.load_group_thread(&account, &group_id, &chat_id);
    // Preserve unread — only `open_group_chat` clears it (see refresh_chat).
    let prev_unread = cached.as_ref().map(|s| s.unread_count).unwrap_or(0);
    let cached_msgs = cached.map(|s| s.messages).unwrap_or_default();
    let merged = merge_group_thread(cached_msgs, server, &account, now_unix());
    let (bounded, trimmed) = bound_thread(merged);
    let snapshot = GroupThreadSnapshot {
        account_steam_id: account.clone(),
        group_id: group_id.clone(),
        chat_id: chat_id.clone(),
        messages: bounded,
        more_available: trimmed || server_more || server_full_page,
        fetched_at: now_unix(),
        unread_count: prev_unread,
    };
    cache.save_group_thread(&snapshot);
    Ok(GroupThreadDto {
        messages: recover_group_states(&snapshot.messages)
            .iter()
            .map(|m| cached_msg_to_group_dto(&group_id, &chat_id, m))
            .collect(),
        more_available: snapshot.more_available,
    })
}

/// Send a text message to a group channel (CM service method). The message is
/// persisted to the thread cache as `sent` on success (group sends have no
/// echo; `refresh_group_chat` reconciles the server identity) or
/// `failedRetryable` on failure.
#[tauri::command]
pub async fn send_group_message(
    state: State<'_, AppState>,
    group_id: String,
    chat_id: String,
    text: String,
) -> Result<GroupMessageDto, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(sid, &access_token).await?;
    let mut req = proto_wire::Writer::new();
    req.varint(1, group_id.parse::<u64>().map_err(|_| "invalid group id")?);
    req.varint(2, chat_id.parse::<u64>().map_err(|_| "invalid chat id")?);
    req.string(3, text.trim());
    req.bool(4, true);
    let account = sid.to_string();
    let body = text.trim().to_string();
    if body.is_empty() {
        return Err("消息不能为空".to_string());
    }
    let local = CachedMessage {
        local_id: Some(new_local_id()),
        timestamp: now_unix(),
        ordinal: 0,
        sender_steam_id: account.clone(),
        body: body.clone(),
        delivery_state: DeliveryState::Sent,
    };
    match client
        .call_service("ChatRoom.SendChatMessage#1", req.finish())
        .await
    {
        Ok(_) => {
            let dto = cached_msg_to_group_dto(&group_id, &chat_id, &local);
            let _guard = social_cache_lock().lock().await;
            if let Some(mut cache) = open_cache(&state.tool_dir, sid) {
                let mut thread = cache
                    .load_group_thread(&account, &group_id, &chat_id)
                    .unwrap_or_else(|| empty_group_thread(&account, &group_id, &chat_id));
                thread.messages.push(local);
                let (bounded, _) = bound_thread(thread.messages);
                thread.messages = bounded;
                cache.save_group_thread(&thread);
            }
            Ok(dto)
        }
        Err(e) => {
            let mut failed = local;
            failed.delivery_state = DeliveryState::FailedRetryable;
            let _guard = social_cache_lock().lock().await;
            if let Some(mut cache) = open_cache(&state.tool_dir, sid) {
                let mut thread = cache
                    .load_group_thread(&account, &group_id, &chat_id)
                    .unwrap_or_else(|| empty_group_thread(&account, &group_id, &chat_id));
                thread.messages.push(failed);
                let (bounded, _) = bound_thread(thread.messages);
                thread.messages = bounded;
                cache.save_group_thread(&thread);
            }
            Err(e)
        }
    }
}

// ── E4 图片 / 贴纸 ───────────────────────────────────────────

/// Upload an image into a friend chat and return the CDN URL. Steam's
/// `commitfileupload` attaches the file to the conversation itself.
#[tauri::command]
pub async fn upload_chat_image(
    state: State<'_, AppState>,
    path: String,
    steam_id: String,
) -> Result<String, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let partner = steam_id.parse::<u64>().map_err(|_| "invalid steam id".to_string())?;
    let client = shared_client();
    let (w, h) = image_dimensions(&path)?;
    social::upload_chat_image(
        &client,
        sid,
        &access_token,
        Path::new(&path),
        &social::ChatImageTarget::Friend(partner),
        w,
        h,
    )
    .map_err(|e| e.to_string())
}

/// Upload an image into a group channel and return the CDN URL.
#[tauri::command]
pub async fn upload_group_image(
    state: State<'_, AppState>,
    path: String,
    group_id: String,
    chat_id: String,
) -> Result<String, String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = shared_client();
    let (w, h) = image_dimensions(&path)?;
    social::upload_chat_image(
        &client,
        sid,
        &access_token,
        Path::new(&path),
        &social::ChatImageTarget::GroupRoom {
            group_id: group_id.parse::<u64>().map_err(|_| "invalid group id".to_string())?,
            chat_id: chat_id.parse::<u64>().map_err(|_| "invalid chat id".to_string())?,
        },
        w,
        h,
    )
    .map_err(|e| e.to_string())
}

/// Owned sticker catalogue (CM `ClientEmoticonList`) for the sticker picker.
#[tauri::command]
pub async fn get_sticker_catalog(state: State<'_, AppState>) -> Result<Vec<StickerDto>, String> {
    let (steam_id, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(steam_id, &access_token).await?;
    let stickers = client.get_sticker_catalog().await?;
    Ok(stickers
        .into_iter()
        .map(|s| StickerDto {
            name: s.name,
            image_url: s.image_url,
        })
        .collect())
}

/// Send a sticker to a friend (`/sticker <name>` body, like Steam's web chat).
#[tauri::command]
pub async fn send_sticker_message(
    state: State<'_, AppState>,
    steam_id: String,
    name: String,
) -> Result<(), String> {
    let (sid, access_token) = resolve_session(&state.tool_dir)?;
    let client = ensure_cm(sid, &access_token).await?;
    let id = steam_id.parse::<u64>().map_err(|_| "invalid steam id".to_string())?;
    client.send_sticker(id, &name).await
}

/// Read an image file's pixel dimensions (Steam requires them on upload).
fn image_dimensions(path: &str) -> Result<(u32, u32), String> {
    let reader = image::ImageReader::open(path).map_err(|e| format!("无法读取图片: {}", e))?;
    let (w, h) = reader.into_dimensions().map_err(|e| format!("无法解析图片尺寸: {}", e))?;
    Ok((w, h))
}
