//! Social chat cache (friends, private chat, group chat).
//!
//! A per-account encrypted cache of the Steam social surfaces used by the
//! Steam Hub social tab. Mirrors the cache layering of the reference Android
//! client (friend list / private chat / group chat snapshots) — implemented
//! here as pure logic over the hardened `SecureStore` so the bound, merge, and
//! delivery-state recovery rules are independently testable.
//!
//! # Storage
//!
//! Each account owns one `SecureStore` file (`social_cache_<steamid>.enc.json`,
//! DPAPI-protected AES-256-GCM). Cache keys: `friends`, `groups`, `sessions`,
//! `thread|<partner>`, `thread_g|<group>|<chat>`.
//!
//! # Delivery states
//!
//! `Sent` is the only trusted terminal state. `Pending` marks an optimistic
//! send not yet confirmed by the server; on friend-thread load it is reported
//! to the UI as `verifying` (the app cannot know if it reached Steam while it
//! was closed — the next `refresh_chat` reconciles it against history). On
//! group-thread load any non-`Sent` message is reported as `failedRetryable`.
//! `Verifying` is transient and never persisted.

use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use steam_sdk::crypto::secure_store::SecureStore;

/// Confirmed messages kept per thread (newest N).
pub const MAX_RECENT_MESSAGES: usize = 500;
/// Unconfirmed messages retained beyond the recent window (bounds growth;
/// unconfirmed messages must never be dropped).
pub const MAX_RETAINED_UNCONFIRMED: usize = 64;
/// Twin-matching window between a local optimistic timestamp and the server's.
pub const RECONCILE_WINDOW_SECS: u64 = 60;

/// Delivery lifecycle of a cached chat message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryState {
    /// Server-confirmed (came from history, or correlated from a CM echo).
    Sent,
    /// Optimistically appended / in flight; not yet confirmed.
    Pending,
    /// Transient, never persisted: a `Pending` message loaded for a friend
    /// thread while the app re-checks whether it reached the server.
    Verifying,
    /// Send failed; can be retried.
    FailedRetryable,
}

impl DeliveryState {
    /// Wire value sent to the frontend (`ChatMessageDto.deliveryState`).
    pub fn to_dto_str(self) -> &'static str {
        match self {
            DeliveryState::Sent => "sent",
            DeliveryState::Pending => "pending",
            DeliveryState::Verifying => "verifying",
            DeliveryState::FailedRetryable => "failedRetryable",
        }
    }
}

/// One cached message in a thread.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedMessage {
    /// Local identity for optimistic messages; cleared once correlated to a
    /// server identity (the server's `(timestamp, ordinal)`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_id: Option<String>,
    pub timestamp: u64,
    pub ordinal: u32,
    pub sender_steam_id: String,
    pub body: String,
    pub delivery_state: DeliveryState,
}

/// One private-chat thread snapshot persisted per partner.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendThreadSnapshot {
    pub account_steam_id: String,
    pub partner_steam_id: String,
    pub messages: Vec<CachedMessage>,
    pub more_available: bool,
    pub fetched_at: u64,
    #[serde(default)]
    pub unread_count: u32,
}

/// One group-channel thread snapshot persisted per group + chat.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupThreadSnapshot {
    pub account_steam_id: String,
    pub group_id: String,
    pub chat_id: String,
    pub messages: Vec<CachedMessage>,
    pub more_available: bool,
    pub fetched_at: u64,
    #[serde(default)]
    pub unread_count: u32,
}

/// One friend in the cached friends snapshot (persona + presence).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendCacheEntry {
    pub steam_id: String,
    pub persona_name: Option<String>,
    pub avatar_url: Option<String>,
    pub online_state: String,
    pub in_game_name: Option<String>,
    pub last_logoff: Option<u64>,
}

/// Friends snapshot persisted per account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsSnapshot {
    pub account_steam_id: String,
    pub friends: Vec<FriendCacheEntry>,
    pub fetched_at: u64,
}

/// One channel (room) in a cached group.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupRoomCacheEntry {
    pub chat_id: String,
    pub name: String,
    pub last_message: String,
    pub last_message_timestamp: u64,
    pub last_sender_steam_id: String,
}

/// One chat room group in the cached groups snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupCacheEntry {
    pub group_id: String,
    pub name: String,
    pub default_chat_id: String,
    pub rooms: Vec<GroupRoomCacheEntry>,
}

/// Groups snapshot persisted per account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupsSnapshot {
    pub account_steam_id: String,
    pub groups: Vec<GroupCacheEntry>,
    pub fetched_at: u64,
}

/// One conversation summary in the sessions snapshot (recent-chat list).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionEntry {
    pub partner_steam_id: String,
    pub last_message: String,
    pub last_timestamp: u64,
    #[serde(default)]
    pub unread_count: u32,
}

/// Sessions snapshot persisted per account (derived from friends + threads).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSessionsSnapshot {
    pub account_steam_id: String,
    pub sessions: Vec<ChatSessionEntry>,
    pub fetched_at: u64,
}

/// A server-fetched history message in a neutral form both merge functions
/// accept (the command layer parses Web-API / CM payloads into this).
#[derive(Debug, Clone, PartialEq)]
pub struct ServerMsg {
    pub timestamp: u64,
    pub ordinal: u32,
    pub sender_steam_id: String,
    pub body: String,
}

/// A fresh random local id for an optimistic message.
pub fn new_local_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Bound a thread to a bounded size: keep the newest `MAX_RECENT_MESSAGES`
/// confirmed messages plus up to `MAX_RETAINED_UNCONFIRMED` older unconfirmed
/// ones (an unconfirmed message must never be dropped silently). Returns the
/// bounded list and whether older history exists (`more_available`).
pub fn bound_thread(messages: Vec<CachedMessage>) -> (Vec<CachedMessage>, bool) {
    let recent_start = messages.len().saturating_sub(MAX_RECENT_MESSAGES);
    if recent_start == 0 {
        return (messages, false);
    }
    // Indices of older-than-window messages that must be kept (unconfirmed),
    // newest 64 of them.
    let retained: HashSet<usize> = messages
        .iter()
        .enumerate()
        .take(recent_start)
        .filter(|(_, m)| m.delivery_state != DeliveryState::Sent)
        .map(|(i, _)| i)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .take(MAX_RETAINED_UNCONFIRMED)
        .collect();
    let bounded: Vec<CachedMessage> = messages
        .into_iter()
        .enumerate()
        .filter(|(i, _)| *i >= recent_start || retained.contains(i))
        .map(|(_, m)| m)
        .collect();
    (bounded, true)
}

/// Friend-thread load mapping: stored `Pending` is reported to the UI as
/// `verifying` (may have been delivered while the app was closed). `Sent` is
/// untouched. The caller must not persist the result — `Verifying` is
/// transient and never written back.
pub fn recover_friend_states(messages: &[CachedMessage]) -> Vec<CachedMessage> {
    messages
        .iter()
        .map(|m| {
            let mut m = m.clone();
            if m.delivery_state == DeliveryState::Pending {
                m.delivery_state = DeliveryState::Verifying;
            }
            m
        })
        .collect()
}

/// Group-thread load mapping: any non-`Sent` stored message is reported as
/// `failedRetryable` (it can be re-sent). `Sent` is untouched. Transient.
pub fn recover_group_states(messages: &[CachedMessage]) -> Vec<CachedMessage> {
    messages
        .iter()
        .map(|m| {
            let mut m = m.clone();
            if m.delivery_state != DeliveryState::Sent {
                m.delivery_state = DeliveryState::FailedRetryable;
            }
            m
        })
        .collect()
}

/// Merge a friend thread's cached messages with fresh server history.
///
/// - Server messages are deduplicated against the cache by the friend identity
///   `(timestamp, sender, body)` (Web-API history has no ordinal).
/// - Local self-messages (pending, or self-sent with a local identity) that
///   lack a verbatim server identity are twin-matched against history by
///   `sender == self`, same body, and a timestamp within `RECONCILE_WINDOW_SECS`;
///   a match adopts the server identity and marks `Sent`.
/// - An unmatched self message only becomes `FailedRetryable` once it is older
///   than `RECONCILE_WINDOW_SECS` (`now_ts`): a recent send may still be in
///   flight (its echo or history entry has not surfaced yet) and must not be
///   falsely failed.
/// - Result is sorted by `(timestamp, ordinal)`.
pub fn merge_friend_thread(
    cached: Vec<CachedMessage>,
    server: Vec<ServerMsg>,
    self_id: &str,
    now_ts: u64,
) -> Vec<CachedMessage> {
    merge_thread(cached, server, self_id, now_ts, |m, sm| {
        m.timestamp == sm.timestamp && m.sender_steam_id == sm.sender_steam_id && m.body == sm.body
    })
}

/// Group-thread variant; identity is `(timestamp, ordinal, sender)`.
pub fn merge_group_thread(
    cached: Vec<CachedMessage>,
    server: Vec<ServerMsg>,
    self_id: &str,
    now_ts: u64,
) -> Vec<CachedMessage> {
    merge_thread(cached, server, self_id, now_ts, |m, sm| {
        m.timestamp == sm.timestamp && m.ordinal == sm.ordinal && m.sender_steam_id == sm.sender_steam_id
    })
}

fn merge_thread<F>(
    cached: Vec<CachedMessage>,
    server: Vec<ServerMsg>,
    self_id: &str,
    now_ts: u64,
    matches_identity: F,
) -> Vec<CachedMessage>
where
    F: Fn(&CachedMessage, &ServerMsg) -> bool,
{
    let mut merged: Vec<CachedMessage> = Vec::with_capacity(cached.len() + server.len());
    // Unconsumed server messages. A consumed twin is removed so two identical
    // local sends (same body) cannot both adopt the same server identity.
    let mut available: Vec<ServerMsg> = server.clone();

    for mut m in cached {
        let local_self = m.sender_steam_id == self_id
            && !server.iter().any(|sm| matches_identity(&m, sm));
        if local_self {
            if let Some(idx) = find_self_twin(&available, self_id, &m.body, m.timestamp) {
                let twin = available.remove(idx);
                m.timestamp = twin.timestamp;
                m.ordinal = twin.ordinal;
                m.local_id = None;
                m.delivery_state = DeliveryState::Sent;
            } else if m.delivery_state != DeliveryState::Sent
                && now_ts.saturating_sub(m.timestamp) > RECONCILE_WINDOW_SECS
            {
                // Old enough that the echo / history had time to surface it.
                m.delivery_state = DeliveryState::FailedRetryable;
            }
        }
        merged.push(m);
    }

    for sm in &server {
        if !merged.iter().any(|m| matches_identity(m, sm)) {
            merged.push(CachedMessage {
                local_id: None,
                timestamp: sm.timestamp,
                ordinal: sm.ordinal,
                sender_steam_id: sm.sender_steam_id.clone(),
                body: sm.body.clone(),
                delivery_state: DeliveryState::Sent,
            });
        }
    }

    merged.sort_by_key(|m| (m.timestamp, m.ordinal));
    merged
}

/// Find the index of a history message that is the server twin of a local
/// optimistic send: sent by `self_id`, same body, timestamp within the
/// reconcile window. Returns the index so the caller can consume it (preventing
/// two identical local sends from adopting the same server twin).
fn find_self_twin(server: &[ServerMsg], self_id: &str, body: &str, local_ts: u64) -> Option<usize> {
    server.iter().position(|sm| {
        sm.sender_steam_id == self_id
            && sm.body == body
            && sm.timestamp.abs_diff(local_ts) <= RECONCILE_WINDOW_SECS
    })
}

// ── Write-through helpers (CM poll path) ─────────────────────

/// Correlate a CM echo of our own friend send to the local cache entry: adopt
/// the server `(timestamp, ordinal)` and mark it `Sent`. Matches the oldest
/// non-`Sent` entry with the same body (FIFO) — including a message previously
/// (perhaps wrongly) marked `FailedRetryable`, so an echo is always able to
/// confirm delivery. Returns whether an entry was matched; the caller persists.
pub fn correlate_friend_echo(
    thread: &mut FriendThreadSnapshot,
    body: &str,
    server_ts: u64,
    server_ordinal: u32,
) -> bool {
    if let Some(m) = thread
        .messages
        .iter_mut()
        .find(|m| m.delivery_state != DeliveryState::Sent && m.body == body)
    {
        m.timestamp = server_ts;
        m.ordinal = server_ordinal;
        m.local_id = None;
        m.delivery_state = DeliveryState::Sent;
        true
    } else {
        false
    }
}

/// Append a server-confirmed incoming message to a friend thread (idempotent
/// by friend identity), bumping `unread_count` when this is not the currently
/// active conversation. The caller persists.
pub fn append_friend_incoming(
    thread: &mut FriendThreadSnapshot,
    m: ServerMsg,
    active_partner: &str,
) {
    let already = thread.messages.iter().any(|c| {
        c.timestamp == m.timestamp && c.sender_steam_id == m.sender_steam_id && c.body == m.body
    });
    if already {
        return;
    }
    thread.messages.push(CachedMessage {
        local_id: None,
        timestamp: m.timestamp,
        ordinal: m.ordinal,
        sender_steam_id: m.sender_steam_id.clone(),
        body: m.body,
        delivery_state: DeliveryState::Sent,
    });
    if m.sender_steam_id != active_partner {
        thread.unread_count = thread.unread_count.saturating_add(1);
    }
}

/// Group-thread variant; `active_group` is `Some((group, chat))` when that
/// channel is the one currently open (no unread bump).
pub fn append_group_incoming(
    thread: &mut GroupThreadSnapshot,
    m: ServerMsg,
    active_group: Option<(&str, &str)>,
) {
    let already = thread.messages.iter().any(|c| {
        c.timestamp == m.timestamp && c.ordinal == m.ordinal && c.sender_steam_id == m.sender_steam_id
    });
    if already {
        return;
    }
    thread.messages.push(CachedMessage {
        local_id: None,
        timestamp: m.timestamp,
        ordinal: m.ordinal,
        sender_steam_id: m.sender_steam_id.clone(),
        body: m.body,
        delivery_state: DeliveryState::Sent,
    });
    let active = active_group.is_some_and(|(g, c)| g == thread.group_id && c == thread.chat_id);
    if !active {
        thread.unread_count = thread.unread_count.saturating_add(1);
    }
}

// ── SecureStore-backed per-account cache ─────────────────────

/// Per-account social cache over a `SecureStore` file. The command layer must
/// serialize access (reads + writes reopen the store file each call).
pub struct SocialCache {
    store: SecureStore,
}

impl SocialCache {
    /// Open (or create) the cache for an account at `tool_dir/social_cache_<steamid>.enc.json`.
    pub fn open(tool_dir: &Path, account_steam_id: u64) -> anyhow::Result<Self> {
        let path = tool_dir.join(format!("social_cache_{}.enc.json", account_steam_id));
        let store = SecureStore::open(&path)?;
        Ok(SocialCache { store })
    }

    // Friends.

    pub fn load_friends(&self, account: &str) -> Option<FriendsSnapshot> {
        load(&self.store, "friends")
            .filter(|s: &FriendsSnapshot| s.account_steam_id == account)
    }

    pub fn save_friends(&mut self, snapshot: &FriendsSnapshot) {
        save(&mut self.store, "friends", snapshot);
    }

    // Groups.

    pub fn load_groups(&self, account: &str) -> Option<GroupsSnapshot> {
        load(&self.store, "groups")
            .filter(|s: &GroupsSnapshot| s.account_steam_id == account)
    }

    pub fn save_groups(&mut self, snapshot: &GroupsSnapshot) {
        save(&mut self.store, "groups", snapshot);
    }

    // Sessions (recent conversations + unread).

    pub fn load_sessions(&self, account: &str) -> Option<ChatSessionsSnapshot> {
        load(&self.store, "sessions")
            .filter(|s: &ChatSessionsSnapshot| s.account_steam_id == account)
    }

    pub fn save_sessions(&mut self, snapshot: &ChatSessionsSnapshot) {
        save(&mut self.store, "sessions", snapshot);
    }

    // Friend threads.

    pub fn load_friend_thread(&self, account: &str, partner: &str) -> Option<FriendThreadSnapshot> {
        load(&self.store, &format!("thread|{}", partner)).filter(|s: &FriendThreadSnapshot| {
            s.account_steam_id == account && s.partner_steam_id == partner
        })
    }

    pub fn save_friend_thread(&mut self, snapshot: &FriendThreadSnapshot) {
        save(
            &mut self.store,
            &format!("thread|{}", snapshot.partner_steam_id),
            snapshot,
        );
    }

    // Group threads.

    pub fn load_group_thread(
        &self,
        account: &str,
        group_id: &str,
        chat_id: &str,
    ) -> Option<GroupThreadSnapshot> {
        load(
            &self.store,
            &format!("thread_g|{}|{}", group_id, chat_id),
        )
        .filter(|s: &GroupThreadSnapshot| {
            s.account_steam_id == account && s.group_id == group_id && s.chat_id == chat_id
        })
    }

    pub fn save_group_thread(&mut self, snapshot: &GroupThreadSnapshot) {
        save(
            &mut self.store,
            &format!("thread_g|{}|{}", snapshot.group_id, snapshot.chat_id),
            snapshot,
        );
    }
}

fn load<T: serde::de::DeserializeOwned>(store: &SecureStore, key: &str) -> Option<T> {
    let bytes = store.get(key).ok()??;
    serde_json::from_slice(&bytes).ok()
}

fn save<T: Serialize>(store: &mut SecureStore, key: &str, value: &T) {
    // Best-effort: on any failure keep the previous cache intact.
    if let Ok(bytes) = serde_json::to_vec(value) {
        let _ = store.set(key, &bytes);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(ts: u64, ordinal: u32, sender: &str, body: &str) -> CachedMessage {
        CachedMessage {
            local_id: None,
            timestamp: ts,
            ordinal,
            sender_steam_id: sender.to_string(),
            body: body.to_string(),
            delivery_state: DeliveryState::Sent,
        }
    }

    fn pending(ts: u64, sender: &str, body: &str) -> CachedMessage {
        let mut m = msg(ts, 0, sender, body);
        m.delivery_state = DeliveryState::Pending;
        m.local_id = Some("local-1".into());
        m
    }

    fn server_msg(ts: u64, ordinal: u32, sender: &str, body: &str) -> ServerMsg {
        ServerMsg {
            timestamp: ts,
            ordinal,
            sender_steam_id: sender.to_string(),
            body: body.to_string(),
        }
    }

    // T2: bound_thread

    #[test]
    fn bound_keeps_recent_sent_window() {
        let all: Vec<CachedMessage> = (0..501).map(|i| msg(i, 0, "f", &format!("m{}", i))).collect();
        let (bounded, more) = bound_thread(all);
        assert_eq!(bounded.len(), MAX_RECENT_MESSAGES);
        assert!(more);
        // The newest 500 are kept.
        assert_eq!(bounded.first().unwrap().timestamp, 1);
        assert_eq!(bounded.last().unwrap().timestamp, 500);
    }

    #[test]
    fn bound_retains_old_unconfirmed() {
        let mut all: Vec<CachedMessage> = (0..(MAX_RECENT_MESSAGES + 66) as u64)
            .map(|i| msg(i, 0, "f", &format!("m{}", i)))
            .collect();
        // First 66 are old + unconfirmed, rest are recent + confirmed.
        for m in all.iter_mut().take(66) {
            m.delivery_state = DeliveryState::Pending;
        }
        let (bounded, _) = bound_thread(all);
        let unconfirmed = bounded.iter().filter(|m| m.delivery_state != DeliveryState::Sent).count();
        assert_eq!(unconfirmed, MAX_RETAINED_UNCONFIRMED);
        assert_eq!(bounded.len(), MAX_RECENT_MESSAGES + MAX_RETAINED_UNCONFIRMED);
    }

    #[test]
    fn bound_under_limit_is_unchanged() {
        let all: Vec<CachedMessage> = (0..100).map(|i| msg(i, 0, "f", "x")).collect();
        let (bounded, more) = bound_thread(all);
        assert_eq!(bounded.len(), 100);
        assert!(!more);
    }

    // T3: recover_states

    #[test]
    fn friend_recovery_maps_pending_to_verifying() {
        let msgs = vec![msg(1, 0, "f", "ok"), pending(2, "me", "hi"), msg(3, 0, "f", "ok2")];
        let recovered = recover_friend_states(&msgs);
        assert_eq!(recovered[0].delivery_state, DeliveryState::Sent);
        assert_eq!(recovered[1].delivery_state, DeliveryState::Verifying);
        assert_eq!(recovered[2].delivery_state, DeliveryState::Sent);
    }

    #[test]
    fn group_recovery_maps_non_sent_to_failed_retryable() {
        let msgs = vec![
            msg(1, 0, "f", "ok"),
            pending(2, "me", "hi"),
            msg(3, 0, "f", "ok2"),
        ];
        let recovered = recover_group_states(&msgs);
        assert_eq!(recovered[0].delivery_state, DeliveryState::Sent);
        assert_eq!(recovered[1].delivery_state, DeliveryState::FailedRetryable);
        assert_eq!(recovered[2].delivery_state, DeliveryState::Sent);
    }

    // T4: merge_thread

    #[test]
    fn merge_dedupes_by_friend_identity() {
        let cached = vec![msg(1, 0, "f", "hi")];
        let server = vec![server_msg(1, 0, "f", "hi"), server_msg(2, 0, "f", "yo")];
        let merged = merge_friend_thread(cached, server, "me", 1000);
        assert_eq!(merged.len(), 2);
    }

    #[test]
    fn merge_reconciles_optimistic_self_message() {
        let cached = vec![pending(100, "me", "hello")];
        // Server twin at ts 130 (within 60s window), own message with real ts.
        let server = vec![
            server_msg(100, 0, "f", "hello back"),
            server_msg(130, 0, "me", "hello"),
        ];
        let merged = merge_friend_thread(cached, server, "me", 1000);
        assert_eq!(merged.len(), 2);
        let self_msg = merged.iter().find(|m| m.sender_steam_id == "me").unwrap();
        assert_eq!(self_msg.timestamp, 130);
        assert_eq!(self_msg.delivery_state, DeliveryState::Sent);
        assert_eq!(self_msg.local_id, None);
    }

    #[test]
    fn merge_marks_old_unmatched_pending_failed() {
        let cached = vec![pending(100, "me", "never-delivered")];
        let server = vec![server_msg(200, 0, "f", "other")];
        // now_ts far enough that the send is older than the reconcile window.
        let merged = merge_friend_thread(cached, server, "me", 1000);
        let self_msg = merged.iter().find(|m| m.sender_steam_id == "me").unwrap();
        assert_eq!(self_msg.delivery_state, DeliveryState::FailedRetryable);
        assert!(merged.iter().all(|m| m.sender_steam_id != "me" || m.timestamp == 100));
    }

    #[test]
    fn merge_keeps_recent_unmatched_pending_pending() {
        // A message sent moments ago whose echo/history has not surfaced yet
        // must NOT be falsely failed — it may still be in flight.
        let cached = vec![pending(995, "me", "in-flight")];
        let server = vec![server_msg(998, 0, "f", "other")];
        let merged = merge_friend_thread(cached, server, "me", 1000);
        let self_msg = merged.iter().find(|m| m.sender_steam_id == "me").unwrap();
        assert_eq!(self_msg.delivery_state, DeliveryState::Pending);
    }

    #[test]
    fn merge_consumes_twins_for_identical_sends() {
        // Two identical local sends (same body) must each adopt a distinct
        // server twin, not both claim the first one (no duplicate).
        let cached = vec![pending(100, "me", "hi"), pending(102, "me", "hi")];
        let server = vec![server_msg(130, 0, "me", "hi"), server_msg(133, 0, "me", "hi")];
        let merged = merge_friend_thread(cached, server, "me", 1000);
        let self_msgs: Vec<_> = merged.iter().filter(|m| m.sender_steam_id == "me").collect();
        assert_eq!(self_msgs.len(), 2);
        assert_eq!(self_msgs[0].timestamp, 130);
        assert_eq!(self_msgs[1].timestamp, 133);
        assert_eq!(merged.len(), 2);
    }

    #[test]
    fn group_merge_uses_ordinal_identity() {
        // Same second, same sender, different bodies — ordinal distinguishes.
        let cached = Vec::new();
        let server = vec![
            server_msg(5, 1, "f", "one"),
            server_msg(5, 2, "f", "two"),
        ];
        let merged = merge_group_thread(cached, server, "me", 1000);
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].ordinal, 1);
        assert_eq!(merged[1].ordinal, 2);
    }

    #[test]
    fn group_merge_reconciles_self_sent_local_identity() {
        // A self message written on send with a local timestamp/ordinal 0,
        // reconciled to the real server identity from history.
        let mut self_local = msg(10, 0, "me", "group hi");
        self_local.local_id = Some("g-local".into());
        let cached = vec![self_local];
        let server = vec![server_msg(12, 7, "me", "group hi"), server_msg(11, 1, "f", "other")];
        let merged = merge_group_thread(cached, server, "me", 1000);
        let self_msg = merged.iter().find(|m| m.sender_steam_id == "me").unwrap();
        assert_eq!((self_msg.timestamp, self_msg.ordinal), (12, 7));
        assert_eq!(self_msg.delivery_state, DeliveryState::Sent);
        // No duplicate of the server twin.
        assert_eq!(merged.len(), 2);
    }

    // T5: SocialCache storage

    fn friend_thread(partner: &str) -> FriendThreadSnapshot {
        FriendThreadSnapshot {
            account_steam_id: "111".into(),
            partner_steam_id: partner.into(),
            messages: vec![msg(1, 0, partner, "hi"), msg(2, 0, "111", "yo")],
            more_available: false,
            fetched_at: 100,
            unread_count: 0,
        }
    }

    #[test]
    fn cache_roundtrips_friend_thread() {
        let dir = tempfile::tempdir().unwrap();
        {
            let mut cache = SocialCache::open(dir.path(), 111).unwrap();
            cache.save_friend_thread(&friend_thread("222"));
        }
        {
            let cache = SocialCache::open(dir.path(), 111).unwrap();
            let loaded = cache.load_friend_thread("111", "222").unwrap();
            assert_eq!(loaded.messages.len(), 2);
            assert_eq!(loaded.partner_steam_id, "222");
            assert_eq!(loaded.messages[1].body, "yo");
        }
    }

    #[test]
    fn cache_ownership_guard_rejects_wrong_ids() {
        let dir = tempfile::tempdir().unwrap();
        {
            let mut cache = SocialCache::open(dir.path(), 111).unwrap();
            cache.save_friend_thread(&friend_thread("222"));
        }
        let cache = SocialCache::open(dir.path(), 111).unwrap();
        // Wrong account.
        assert!(cache.load_friend_thread("999", "222").is_none());
        // Wrong partner.
        assert!(cache.load_friend_thread("111", "333").is_none());
        // Correct.
        assert!(cache.load_friend_thread("111", "222").is_some());
    }

    #[test]
    fn cache_missing_yields_none() {
        let dir = tempfile::tempdir().unwrap();
        let cache = SocialCache::open(dir.path(), 111).unwrap();
        assert!(cache.load_friend_thread("111", "222").is_none());
        assert!(cache.load_friends("111").is_none());
        assert!(cache.load_sessions("111").is_none());
    }

    #[test]
    fn cache_tampered_file_fails_open() {
        // A store file that is not valid SecureStore JSON fails open (the
        // command layer treats this as "no cache" and falls back to network).
        let dir = tempfile::tempdir().unwrap();
        let store_path = dir.path().join("social_cache_999.enc.json");
        std::fs::write(&store_path, b"{not json").unwrap();
        assert!(SocialCache::open(dir.path(), 999).is_err());
    }

    #[test]
    fn cache_is_encrypted_at_rest() {
        const PROBE: &str = "cache_encryption_probe_message_body_9283";
        let dir = tempfile::tempdir().unwrap();
        {
            let mut thread = friend_thread("222");
            thread.messages.push(msg(99, 0, "222", PROBE));
            let mut cache = SocialCache::open(dir.path(), 111).unwrap();
            cache.save_friend_thread(&thread);
        }
        let raw = std::fs::read_to_string(dir.path().join("social_cache_111.enc.json")).unwrap();
        // Message bodies must not appear in plaintext; the store is AES-GCM
        // ciphertext entries.
        assert!(!raw.contains(PROBE));
        assert!(raw.contains("ciphertext"));
        // DPAPI master key present on Windows.
        #[cfg(target_os = "windows")]
        assert!(raw.contains("master_key"));
    }

    // Write-through helpers

    #[test]
    fn echo_correlates_pending_fifo() {
        let mut thread = friend_thread("222");
        thread.messages = vec![pending(1, "111", "a"), pending(2, "111", "b")];
        // Echo for "a" (the oldest matching body) adopts the server identity.
        assert!(correlate_friend_echo(&mut thread, "a", 100, 5));
        assert_eq!(thread.messages[0].timestamp, 100);
        assert_eq!(thread.messages[0].ordinal, 5);
        assert_eq!(thread.messages[0].delivery_state, DeliveryState::Sent);
        assert_eq!(thread.messages[0].local_id, None);
        // Second echo for "a" is a no-op (already correlated).
        assert!(!correlate_friend_echo(&mut thread, "a", 101, 6));
    }

    #[test]
    fn echo_self_heals_failed_retryable() {
        // A message wrongly marked failed (e.g. a stale reconcile) must still
        // be confirmable by its echo — delivery proof wins.
        let mut thread = friend_thread("222");
        let mut m = pending(5, "111", "rescued");
        m.delivery_state = DeliveryState::FailedRetryable;
        thread.messages.push(m);
        assert!(correlate_friend_echo(&mut thread, "rescued", 50, 3));
        let rescued = thread
            .messages
            .iter()
            .find(|m| m.body == "rescued")
            .unwrap();
        assert_eq!(rescued.delivery_state, DeliveryState::Sent);
        assert_eq!(rescued.timestamp, 50);
        assert_eq!(rescued.local_id, None);
    }

    #[test]
    fn append_incoming_is_idempotent_and_bumps_unread() {
        let mut thread = friend_thread("222");
        append_friend_incoming(
            &mut thread,
            server_msg(10, 0, "222", "hi"),
            "333", // active conversation is a different partner → unread bump
        );
        assert_eq!(thread.messages.len(), 3); // 2 original + 1
        assert_eq!(thread.unread_count, 1);
        // Same message again: idempotent, no bump.
        append_friend_incoming(&mut thread, server_msg(10, 0, "222", "hi"), "333");
        assert_eq!(thread.messages.len(), 3);
        assert_eq!(thread.unread_count, 1);
        // Active conversation: no bump.
        append_friend_incoming(&mut thread, server_msg(11, 0, "222", "yo"), "222");
        assert_eq!(thread.unread_count, 1);
        assert_eq!(thread.messages.last().unwrap().body, "yo");
    }

    #[test]
    fn group_append_bumps_unread_unless_active() {
        let dir = tempfile::tempdir().unwrap();
        let mut cache = SocialCache::open(dir.path(), 111).unwrap();
        let mut thread = GroupThreadSnapshot {
            account_steam_id: "111".into(),
            group_id: "9".into(),
            chat_id: "2".into(),
            messages: Vec::new(),
            more_available: false,
            fetched_at: 0,
            unread_count: 0,
        };
        // Another channel active → bump.
        append_group_incoming(&mut thread, server_msg(1, 1, "222", "hi"), Some(("9", "3")));
        assert_eq!(thread.unread_count, 1);
        // This channel active → no bump.
        append_group_incoming(&mut thread, server_msg(2, 2, "222", "yo"), Some(("9", "2")));
        assert_eq!(thread.unread_count, 1);
        // No active channel → bump.
        append_group_incoming(&mut thread, server_msg(3, 3, "222", "hey"), None);
        assert_eq!(thread.unread_count, 2);
        let _ = cache.save_group_thread(&thread);
    }
}
