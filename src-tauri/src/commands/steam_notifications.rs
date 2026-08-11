//! Tauri commands for the Steam notification page.
//!
//! Aggregates price drops (persisted log), news for the watched games, and
//! pending mobile confirmations into a single reverse-chronological feed.
//! Only the *read* state is persisted (`steam_notifications.json` holds a set
//! of notification ids) — notification content is derived from the live
//! sources each call, never stored.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use tauri::State;

use crate::AppState;

/// One entry in the notification feed.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamNotificationDto {
    /// Stable id (`drop:<appid>:<date>` / `news:<appid>:<ts>` / `confirmation:<id>`).
    pub id: String,
    pub kind: String,
    pub title: String,
    pub subtitle: String,
    /// Local "YYYY-MM-DD HH:MM:SS" (lexically sortable).
    pub timestamp: String,
    pub read: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct ReadState {
    #[serde(default)]
    read_ids: Vec<String>,
}

fn read_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_notifications.json")
}

fn load_read_ids(path: &Path) -> HashSet<String> {
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(state) = serde_json::from_str::<ReadState>(&content) {
                return state.read_ids.into_iter().collect();
            }
        }
    }
    HashSet::new()
}

fn save_read_ids(path: &Path, read_ids: &HashSet<String>) {
    let mut list: Vec<String> = read_ids.iter().cloned().collect();
    list.sort();
    let state = ReadState { read_ids: list };
    if let Ok(json) = serde_json::to_string_pretty(&state) {
        let _ = std::fs::write(path, json);
    }
}

fn format_unix_ts(ts: u64) -> String {
    chrono::DateTime::from_timestamp(ts as i64, 0)
        .map(|dt| {
            dt.with_timezone(&chrono::Local)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        })
        .unwrap_or_default()
}

/// The aggregated notification feed (newest first).
///
/// `app_ids` is the news-monitoring scope (wishlist ∪ local watchlist),
/// supplied by the frontend.
#[tauri::command]
pub async fn get_notifications(
    state: State<'_, AppState>,
    app_ids: Vec<u32>,
) -> Result<Vec<SteamNotificationDto>, String> {
    let tool_dir = state.tool_dir.clone();
    let mut notifs: Vec<SteamNotificationDto> = Vec::new();

    // 1. Price drops (persisted, newest last in the file).
    let drops = crate::commands::steam_community::load_drop_events(
        &crate::commands::steam_community::drop_events_path(&tool_dir),
    );
    for d in drops {
        notifs.push(SteamNotificationDto {
            id: format!("drop:{}:{}", d.app_id, d.date),
            kind: "price_drop".into(),
            title: format!("App {} 降价", d.app_id),
            subtitle: format!("{} → {}（{}%）", d.prev_price, d.new_price, d.discount_pct),
            timestamp: d.date,
            read: false,
        });
    }

    // 2. News for the watched games.
    if !app_ids.is_empty() {
        if let Ok(news) =
            crate::commands::steam_community::get_news_feed(state.clone(), app_ids, Some(2)).await
        {
            for n in news {
                notifs.push(SteamNotificationDto {
                    id: format!("news:{}:{}", n.app_id, n.date),
                    kind: "news".into(),
                    title: n.title,
                    subtitle: n.feed_label.unwrap_or_default(),
                    timestamp: format_unix_ts(n.date),
                    read: false,
                });
            }
        }
    }

    // 3. Pending mobile confirmations (best-effort; needs a bound authenticator).
    if let Ok(confs) = crate::commands::steam_guard::get_pending_confirmations(state) {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        for c in confs {
            notifs.push(SteamNotificationDto {
                id: format!("confirmation:{}", c.id),
                kind: "confirmation".into(),
                title: c.kind,
                subtitle: c.description,
                timestamp: now.clone(),
                read: false,
            });
        }
    }

    // Apply read state + sort newest first.
    let read_ids = load_read_ids(&read_path(&tool_dir));
    for n in &mut notifs {
        n.read = read_ids.contains(&n.id);
    }
    notifs.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    notifs.truncate(100);
    Ok(notifs)
}

/// Mark the given notification ids as read (merged into the persisted set).
#[tauri::command]
pub fn mark_notifications_read(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let path = read_path(&state.tool_dir);
    let mut read_ids = load_read_ids(&path);
    for id in ids {
        read_ids.insert(id);
    }
    save_read_ids(&path, &read_ids);
    Ok(())
}
