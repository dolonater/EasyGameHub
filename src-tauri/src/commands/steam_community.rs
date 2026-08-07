//! Tauri commands for Steam community features.
//!
//! Added incrementally by phase:
//!   Phase 2 — game news (`get_game_news` / `get_news_feed`) and the manual
//!             watchlist (`get_manual_watchlist` / `add_manual_watch` /
//!             `remove_manual_watch`) that feeds the news stream before the
//!             wishlist lands.
//!   Phase 4 — wishlist, prices and discount detection.
//!   Phase 5 — metadata completion.
//!
//! Follows the same split as the rest of the app: `commands/` maps params and
//! errors only; the logic lives in `steam-sdk` and `core/`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use steam_sdk::client::news;
use steam_sdk::SteamHttpClient;
use tauri::State;

use crate::commands::steam_api::shared_client;
use crate::AppState;

// ── News ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsItemDto {
    pub app_id: u32,
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    pub contents: String,
    pub feed_label: Option<String>,
    pub feed_type: Option<u32>,
    pub date: u64,
}

impl NewsItemDto {
    fn from_news(app_id: u32, item: news::NewsItem) -> Self {
        Self {
            app_id,
            title: item.title,
            url: item.url,
            author: item.author,
            contents: news::strip_html(&item.contents),
            feed_label: item.feed_label,
            feed_type: item.feed_type,
            date: item.date,
        }
    }
}

static NEWS_CACHE: OnceLock<Mutex<HashMap<u32, CachedNews>>> = OnceLock::new();
const NEWS_CACHE_TTL: Duration = Duration::from_secs(10 * 60);
/// File cache survives restarts; refresh from the network when it ages out.
const NEWS_CACHE_FILE_TTL_SECS: u64 = 30 * 60;

#[derive(Clone)]
struct CachedNews {
    fetched_at: Instant,
    items: Vec<NewsItemDto>,
}

fn news_cache() -> &'static Mutex<HashMap<u32, CachedNews>> {
    NEWS_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn load_cached_news(app_id: u32) -> Option<Vec<NewsItemDto>> {
    let cache = news_cache().lock().unwrap();
    cache
        .get(&app_id)
        .filter(|entry| entry.fetched_at.elapsed() < NEWS_CACHE_TTL)
        .map(|entry| entry.items.clone())
}

fn store_cached_news(app_id: u32, items: Vec<NewsItemDto>) {
    news_cache().lock().unwrap().insert(
        app_id,
        CachedNews {
            fetched_at: Instant::now(),
            items,
        },
    );
}

// ── News file cache (survives restarts) ─────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedNewsFile {
    app_id: u32,
    fetched_at: u64,
    items: Vec<NewsItemDto>,
}

static NEWS_FILE_CACHE_LOCK: Mutex<()> = Mutex::new(());

fn news_cache_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_news_cache.json")
}

fn load_news_cache_file(path: &Path) -> Vec<CachedNewsFile> {
    // Locked to avoid reading a half-written file while a parallel fetch is
    // persisting another app's entry.
    let _guard = NEWS_FILE_CACHE_LOCK.lock().unwrap();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(entries) = serde_json::from_str::<Vec<CachedNewsFile>>(&content) {
                return entries;
            }
        }
    }
    Vec::new()
}

fn save_news_cache_file(path: &Path, entries: &[CachedNewsFile]) {
    let _guard = NEWS_FILE_CACHE_LOCK.lock().unwrap();
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = std::fs::write(path, json);
    }
}

/// Fetch news for one app: in-memory cache → file cache → network.
fn fetch_news_for_app(
    client: &SteamHttpClient,
    tool_dir: &Path,
    app_id: u32,
    per_game: u32,
) -> Result<Vec<NewsItemDto>, String> {
    // 1) In-memory cache (fast within a session).
    if let Some(cached) = load_cached_news(app_id) {
        return Ok(cached);
    }

    // 2) File cache (survives restarts) — promote to memory.
    let path = news_cache_path(tool_dir);
    let now = chrono::Utc::now().timestamp() as u64;
    let file_entries = load_news_cache_file(&path);
    if let Some(entry) = file_entries.iter().find(|e| e.app_id == app_id) {
        if now.saturating_sub(entry.fetched_at) < NEWS_CACHE_FILE_TTL_SECS {
            store_cached_news(app_id, entry.items.clone());
            return Ok(entry.items.clone());
        }
    }

    // 3) Network — one request for this app.
    let items = news::get_news_for_app(client, app_id, per_game)
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|item| NewsItemDto::from_news(app_id, item))
        .collect::<Vec<_>>();

    store_cached_news(app_id, items.clone());

    // Append to the file cache (replace any expired entry for this app).
    let mut entries: Vec<CachedNewsFile> = file_entries
        .into_iter()
        .filter(|e| e.app_id != app_id)
        .collect();
    entries.push(CachedNewsFile {
        app_id,
        fetched_at: now,
        items: items.clone(),
    });
    save_news_cache_file(&path, &entries);

    Ok(items)
}

/// Fetch the latest news items for a single game (memory + file cache).
#[tauri::command]
pub async fn get_game_news(
    state: State<'_, AppState>,
    app_id: u32,
    count: Option<u32>,
) -> Result<Vec<NewsItemDto>, String> {
    fetch_news_for_app(&shared_client(), &state.tool_dir, app_id, count.unwrap_or(5))
}

/// Aggregate news for a list of games, newest first, capped at 50 items.
///
/// Apps are fetched in parallel with bounded concurrency, so feed latency is
/// ~one request time instead of one per watched game. Individual app failures
/// are skipped rather than failing the whole feed.
#[tauri::command]
pub async fn get_news_feed(
    state: State<'_, AppState>,
    app_ids: Vec<u32>,
    per_game: Option<u32>,
) -> Result<Vec<NewsItemDto>, String> {
    let per_game = per_game.unwrap_or(3);
    let tool_dir = state.tool_dir.clone();
    let client = shared_client();

    let mut all: Vec<NewsItemDto> = Vec::new();
    const PARALLELISM: usize = 8;
    for chunk in app_ids.chunks(PARALLELISM) {
        let batch: Vec<NewsItemDto> = std::thread::scope(|scope| {
            let handles: Vec<_> = chunk
                .iter()
                .map(|&app_id| {
                    let client = client.clone();
                    let tool_dir = &tool_dir;
                    scope.spawn(move || {
                        fetch_news_for_app(&client, tool_dir, app_id, per_game).unwrap_or_default()
                    })
                })
                .collect();
            handles
                .into_iter()
                .flat_map(|h| h.join().unwrap_or_default())
                .collect()
        });
        all.extend(batch);
    }

    all.sort_by(|a, b| b.date.cmp(&a.date));
    all.truncate(50);
    Ok(all)
}

// ── Manual watchlist (news/discount monitoring scope) ────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchItemDto {
    pub app_id: u32,
    pub name: Option<String>,
    pub added_at: String,
}

fn watchlist_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_watchlist.json")
}

fn load_watchlist(path: &Path) -> Vec<WatchItemDto> {
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(list) = serde_json::from_str::<Vec<WatchItemDto>>(&content) {
                return list;
            }
        }
    }
    Vec::new()
}

fn save_watchlist(path: &Path, list: &[WatchItemDto]) {
    if let Ok(json) = serde_json::to_string_pretty(list) {
        let _ = std::fs::write(path, json);
    }
}

#[tauri::command]
pub fn get_manual_watchlist(state: State<'_, AppState>) -> Result<Vec<WatchItemDto>, String> {
    Ok(load_watchlist(&watchlist_path(&state.tool_dir)))
}

#[tauri::command]
pub fn add_manual_watch(
    state: State<'_, AppState>,
    app_id: u32,
    name: Option<String>,
) -> Result<(), String> {
    let path = watchlist_path(&state.tool_dir);
    let mut list = load_watchlist(&path);
    if !list.iter().any(|item| item.app_id == app_id) {
        list.push(WatchItemDto {
            app_id,
            name: name.filter(|n| !n.trim().is_empty()),
            added_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        });
        save_watchlist(&path, &list);
    }
    Ok(())
}

#[tauri::command]
pub fn remove_manual_watch(state: State<'_, AppState>, app_id: u32) -> Result<(), String> {
    let path = watchlist_path(&state.tool_dir);
    let list = load_watchlist(&path);
    save_watchlist(&path, &list.into_iter().filter(|item| item.app_id != app_id).collect::<Vec<_>>());
    Ok(())
}

// ── Public wishlist ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WishlistItemDto {
    pub app_id: u32,
    pub name: Option<String>,
}

// ── Wishlist cache (stale-while-revalidate, per account) ────

const WISHLIST_CACHE_TTL_SECS: u64 = 10 * 60;
const WISHLIST_STALE_MAX_SECS: u64 = 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedWishlist {
    items: Vec<WishlistItemDto>,
    fetched_at: u64,
}

static WISHLIST_CACHE_LOCK: Mutex<()> = Mutex::new(());

fn wishlist_cache_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_wishlist_cache.json")
}

fn load_wishlist_cache(path: &Path, steam_id: &str) -> Option<CachedWishlist> {
    let content = std::fs::read_to_string(path).ok()?;
    let map: serde_json::Value = serde_json::from_str(&content).ok()?;
    serde_json::from_value(map.get(steam_id)?.clone()).ok()
}

fn save_wishlist_cache(path: &Path, steam_id: &str, entry: &CachedWishlist) {
    let _guard = WISHLIST_CACHE_LOCK.lock().unwrap();
    let mut map = std::fs::read_to_string(path)
        .ok()
        .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    map[steam_id] = serde_json::to_value(entry).unwrap_or(serde_json::Value::Null);
    if let Ok(json) = serde_json::to_string_pretty(&map) {
        let _ = std::fs::write(path, json);
    }
}

fn fetch_wishlist(client: &SteamHttpClient, steam_id: u64) -> Result<Vec<WishlistItemDto>, String> {
    let raw = steam_sdk::client::store::get_wishlist(client, steam_id)
        .map_err(|e| e.to_string())?;
    Ok(raw
        .into_iter()
        .map(|item| WishlistItemDto {
            app_id: item.app_id,
            name: item.name,
        })
        .collect())
}

/// Fetch the logged-in user's public wishlist.
///
/// Served from a per-account file cache with stale-while-revalidate (fresh
/// ≤10 min returns instantly; stale ≤24 h is served while a background thread
/// refreshes it), so re-opening the wishlist tab does not pay a cross-region
/// request every time. Errors (not logged in / private / network) are surfaced
/// to the frontend, which falls back to the local watchlist.
#[tauri::command]
pub async fn get_steam_wishlist(state: State<'_, AppState>) -> Result<Vec<WishlistItemDto>, String> {
    let steam_id = crate::commands::steam_auth::active_steam_id(&state.tool_dir)
        .ok_or_else(|| "Not logged in. Sign in to view your wishlist.".to_string())?;
    let steam_id_str = steam_id.to_string();
    let path = wishlist_cache_path(&state.tool_dir);
    let now = chrono::Utc::now().timestamp() as u64;

    if let Some(cached) = load_wishlist_cache(&path, &steam_id_str) {
        let age = now.saturating_sub(cached.fetched_at);
        if age < WISHLIST_CACHE_TTL_SECS {
            return Ok(cached.items);
        }
        if age < WISHLIST_STALE_MAX_SECS {
            // Serve stale now, refresh in the background.
            let client = shared_client();
            let path = path.clone();
            let key = steam_id_str.clone();
            std::thread::spawn(move || {
                if let Ok(items) = fetch_wishlist(&client, steam_id) {
                    save_wishlist_cache(
                        &path,
                        &key,
                        &CachedWishlist {
                            items,
                            fetched_at: chrono::Utc::now().timestamp() as u64,
                        },
                    );
                }
            });
            return Ok(cached.items);
        }
    }

    // Cold miss — block on the network once.
    let items = fetch_wishlist(&shared_client(), steam_id)?;
    save_wishlist_cache(
        &path,
        &steam_id_str,
        &CachedWishlist {
            items: items.clone(),
            fetched_at: now,
        },
    );
    Ok(items)
}

// ── Prices + discount detection ─────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceDto {
    pub app_id: u32,
    pub currency: Option<String>,
    pub final_price: Option<u64>,
    pub initial_price: Option<u64>,
    pub discount_percent: u32,
    pub final_formatted: Option<String>,
    pub initial_formatted: Option<String>,
    /// True when the final price dropped below the last recorded baseline.
    pub dropped: bool,
}

fn price_baseline_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_price_baseline.json")
}

/// Fetch live prices for a batch of apps and detect drops against the
/// recorded baseline. The baseline is updated to the current price so each
/// price-drop event is only reported once.
#[tauri::command]
pub async fn get_steam_prices(state: State<'_, AppState>, app_ids: Vec<u32>) -> Result<Vec<PriceDto>, String> {
    if app_ids.is_empty() {
        return Ok(Vec::new());
    }

    let baseline_path = price_baseline_path(&state.tool_dir);
    let mut baseline = crate::core::steam_prices::load_price_baseline(&baseline_path);
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut results = Vec::new();
    if let Ok(details) =
        steam_sdk::client::store::get_app_details(&shared_client(), &app_ids, "schinese")
    {
        for detail in details {
            let (final_price, initial_price, discount, currency, final_formatted, initial_formatted) =
                match &detail.price {
                    Some(p) => (
                        Some(p.final_price),
                        Some(p.initial_price),
                        p.discount_percent,
                        Some(p.currency.clone()),
                        p.final_formatted.clone(),
                        p.initial_formatted.clone(),
                    ),
                    None => (None, None, 0, None, None, None),
                };

            let dropped = match final_price {
                Some(fp) => {
                    let prev = baseline.get(&detail.app_id);
                    let currency = currency.clone().unwrap_or_default();
                    let drop =
                        crate::core::steam_prices::check_price_drop(prev, fp, discount, &currency);
                    baseline.insert(
                        detail.app_id,
                        crate::core::steam_prices::PriceBaseline {
                            final_price: fp,
                            discount_pct: discount,
                            checked_at: now.clone(),
                            currency,
                        },
                    );
                    drop
                }
                None => false,
            };

            results.push(PriceDto {
                app_id: detail.app_id,
                currency,
                final_price,
                initial_price,
                discount_percent: discount,
                final_formatted,
                initial_formatted,
                dropped,
            });
        }
    }

    crate::core::steam_prices::save_price_baseline(&baseline_path, &baseline);
    Ok(results)
}

// ── Metadata completion (file cache, 7 days) ────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataDto {
    pub app_id: u32,
    pub name: Option<String>,
    pub short_description: Option<String>,
    pub header_image: Option<String>,
    pub genres: Vec<String>,
    pub developers: Vec<String>,
    pub release_date: Option<String>,
    pub is_free: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedMetadataEntry {
    #[serde(flatten)]
    pub data: MetadataDto,
    pub fetched_at: u64,
}

fn metadata_cache_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_metadata_cache.json")
}

fn load_metadata_cache(path: &Path) -> Vec<CachedMetadataEntry> {
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(entries) = serde_json::from_str::<Vec<CachedMetadataEntry>>(&content) {
                return entries;
            }
        }
    }
    Vec::new()
}

fn save_metadata_cache(path: &Path, entries: &[CachedMetadataEntry]) {
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = std::fs::write(path, json);
    }
}

const METADATA_CACHE_TTL_SECS: u64 = 7 * 24 * 60 * 60;

/// Fetch metadata for a batch of apps, served from the file cache (7 days).
///
/// Missing/expired apps are fetched from the store and written back. Apps
/// without store data simply stay absent from the result.
#[tauri::command]
pub async fn get_steam_metadata(state: State<'_, AppState>, app_ids: Vec<u32>) -> Result<Vec<MetadataDto>, String> {
    if app_ids.is_empty() {
        return Ok(Vec::new());
    }

    let path = metadata_cache_path(&state.tool_dir);
    let now = chrono::Utc::now().timestamp() as u64;
    let mut fresh: std::collections::HashMap<u32, CachedMetadataEntry> = load_metadata_cache(&path)
        .into_iter()
        .filter(|entry| now.saturating_sub(entry.fetched_at) < METADATA_CACHE_TTL_SECS)
        .map(|entry| (entry.data.app_id, entry))
        .collect();

    let missing: Vec<u32> = app_ids
        .iter()
        .copied()
        .filter(|id| !fresh.contains_key(id))
        .collect();

    if !missing.is_empty() {
        let client = shared_client();
        if let Ok(details) = steam_sdk::client::store::get_app_details(&client, &missing, "schinese") {
            for detail in details {
                fresh.insert(
                    detail.app_id,
                    CachedMetadataEntry {
                        data: MetadataDto {
                            app_id: detail.app_id,
                            name: detail.name,
                            short_description: detail.short_description,
                            header_image: detail.header_image,
                            genres: detail.genres,
                            developers: detail.developers,
                            release_date: detail.release_date,
                            is_free: detail.is_free,
                        },
                        fetched_at: now,
                    },
                );
            }
        }
    }

    let result: Vec<MetadataDto> = app_ids
        .iter()
        .filter_map(|id| fresh.get(id))
        .map(|entry| entry.data.clone())
        .collect();
    save_metadata_cache(&path, &fresh.into_values().collect::<Vec<_>>());
    Ok(result)
}
