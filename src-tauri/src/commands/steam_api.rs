//! Tauri commands for Steam Web API features.
//!
//! Bridges `steam-sdk::client` modules to the frontend.
//! Uses `AppState` to access the config file and tool directory.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::ffi::CString;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use steam_sdk::client::{
    achievements::AchievementInfo,
    inventory::{self, OwnedGame},
    local_inventory, store,
};
use steam_sdk::SteamHttpClient;
use tauri::State;

use crate::AppState;

// ── DTOs ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedGameDto {
    pub appid: u32,
    pub name: Option<String>,
    pub playtime_forever: u64,
    pub playtime_2weeks: Option<u64>,
    pub img_icon_url: Option<String>,
    pub img_logo_url: Option<String>,
}

impl From<OwnedGame> for OwnedGameDto {
    fn from(g: OwnedGame) -> Self {
        Self {
            appid: g.appid,
            name: g.name,
            playtime_forever: g.playtime_forever,
            playtime_2weeks: g.playtime_2weeks,
            img_icon_url: g.img_icon_url,
            img_logo_url: g.img_logo_url,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementInfoDto {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub hidden: bool,
    pub icon: Option<String>,
    pub icon_gray: Option<String>,
    pub achieved: bool,
    pub unlock_time: u64,
}

#[derive(Debug, Clone)]
struct CachedAchievements {
    fetched_at: Instant,
    percentage: f64,
    achievements: Vec<AchievementInfo>,
    live_state_available: bool,
    live_state_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementSummaryDto {
    pub percentage: String,
    pub total: usize,
    pub unlocked: usize,
    pub has_achievements: bool,
}

impl From<AchievementInfo> for AchievementInfoDto {
    fn from(a: AchievementInfo) -> Self {
        Self {
            name: a.name,
            display_name: a.display_name,
            description: a.description,
            hidden: a.hidden,
            icon: a.icon,
            icon_gray: a.icon_gray,
            achieved: a.achieved,
            unlock_time: a.unlock_time,
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────

static ACHIEVEMENTS_CACHE: OnceLock<Mutex<HashMap<u32, CachedAchievements>>> = OnceLock::new();
const ACHIEVEMENTS_CACHE_TTL: Duration = Duration::from_secs(10 * 60);

fn achievements_cache() -> &'static Mutex<HashMap<u32, CachedAchievements>> {
    ACHIEVEMENTS_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn load_cached_achievements(app_id: u32) -> Result<CachedAchievements, String> {
    {
        let cache = achievements_cache().lock().unwrap();
        if let Some(entry) = cache.get(&app_id) {
            if entry.fetched_at.elapsed() < ACHIEVEMENTS_CACHE_TTL {
                return Ok(entry.clone());
            }
        }
    }

    let (percentage, achievements, live_state_available, live_state_error) =
        crate::steam_helper::invoke_steam_achievements_helper(app_id)?;
    let entry = CachedAchievements {
        fetched_at: Instant::now(),
        percentage,
        achievements,
        live_state_available,
        live_state_error,
    };

    achievements_cache()
        .lock()
        .unwrap()
        .insert(app_id, entry.clone());

    Ok(entry)
}

/// A shared HTTP client (agent with a connection pool), cloned per call so
/// keep-alive connections are reused across commands instead of re-handshaking.
pub(crate) fn shared_client() -> SteamHttpClient {
    static CLIENT: OnceLock<SteamHttpClient> = OnceLock::new();
    CLIENT.get_or_init(SteamHttpClient::new).clone()
}

fn load_config(state: &AppState) -> Result<crate::core::config::Config, String> {
    crate::core::config::load_config(&state.config_path)
        .map_err(|e| format!("Failed to load config: {}", e))
}

fn save_config(state: &AppState, config: &crate::core::config::Config) -> Result<(), String> {
    crate::core::config::save_config(&state.config_path, config)
        .map_err(|e| format!("Failed to save config: {}", e))
}

fn get_api_key(state: &AppState) -> Result<String, String> {
    let config = load_config(state)?;
    if config.steam_api_key.is_empty() {
        Err("Steam API key not configured. Set it in Settings → Steam API Key.".into())
    } else {
        Ok(config.steam_api_key)
    }
}

fn get_steam_id(state: &AppState) -> Result<u64, String> {
    let config = load_config(state)?;
    if config.cached_steam_id.is_empty() {
        Err("Steam ID not detected. Make sure Steam is installed and you've logged in at least once.".into())
    } else {
        config
            .cached_steam_id
            .parse::<u64>()
            .map_err(|_| "Invalid cached Steam ID".into())
    }
}

// ── Local Inventory (no API key needed) ────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGameDto {
    pub app_id: u32,
    pub name: Option<String>,
    pub playtime_minutes: u64,
    pub is_installed: bool,
    /// ACF installdir (folder name only, e.g. "Counter-Strike Global Offensive")
    pub install_dir: Option<String>,
    /// Full resolved path (e.g. "C:\\...\\steamapps\\common\\Counter-Strike Global Offensive")
    pub install_path: Option<String>,
    pub size_on_disk: Option<u64>,
    /// Whether this game is hidden in the inventory
    pub is_hidden: bool,
}

/// Get Steam game library from local VDF files (no API key needed).
/// This is the same approach SteamTools uses — reads `localconfig.vdf`
/// for owned games and `appmanifest_*.acf` for installed games.
/// Cross-references with Doona's game index for proper names.
/// Also merges custom names from steam_game_names.json.
#[tauri::command]
pub async fn get_local_steam_games(state: State<'_, AppState>) -> Result<Vec<LocalGameDto>, String> {
    let name_map = build_steam_name_map(&state.games_index_path);
    let hidden = load_hidden_games(&state.tool_dir);
    // Steam appinfo.vdf binary cache — local, covers ALL Steam apps
    let appinfo_map = build_appinfo_name_map();
    let custom_names = load_custom_game_names(&state.tool_dir);

    // Build library-roots-to-steamapps for resolving install paths
    let steam_dir = steam_sdk::local::steam_path::detect_steam().ok();
    let library_paths: Vec<std::path::PathBuf> = steam_dir
        .as_ref()
        .map(|s| steam_sdk::local::download::get_library_paths(&s.path).unwrap_or_default())
        .unwrap_or_default();

    steam_sdk::client::local_inventory::get_local_games()
        .map(|games| {
            games
                .into_iter()
                .map(|g| {
                    // Priority: custom > ACF > localconfig > game_index > appinfo.vdf
                    let name = custom_names
                        .get(&g.app_id)
                        .cloned()
                        .or_else(|| g.name.clone())
                        .or_else(|| name_map.get(&g.app_id).cloned())
                        .or_else(|| appinfo_map.get(&g.app_id).cloned());

                    // Resolve full install path: {steamapps}/common/{installdir}
                    // library_paths entries end with "steamapps" already.
                    let install_path = g.install_dir.as_ref().and_then(|idir| {
                        for steamapps in &library_paths {
                            let full = steamapps.join("common").join(idir);
                            if full.exists() {
                                return Some(full.to_string_lossy().to_string());
                            }
                        }
                        None
                    });

                    LocalGameDto {
                        app_id: g.app_id,
                        name,
                        playtime_minutes: g.playtime_minutes,
                        is_installed: g.is_installed,
                        install_dir: g.install_dir,
                        install_path,
                        size_on_disk: g.size_on_disk,
                        is_hidden: hidden.contains(&g.app_id),
                    }
                })
                .collect()
        })
        .map_err(|e| e.to_string())
}

/// Build a HashMap mapping steam_app_id → game name from the game index.
fn build_steam_name_map(index_path: &std::path::Path) -> std::collections::HashMap<u32, String> {
    let mut map = std::collections::HashMap::new();
    if let Ok(content) = std::fs::read_to_string(index_path) {
        if let Ok(index) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(entries) = index.get("entries").and_then(|v| v.as_object()) {
                for (_game_id, entry) in entries {
                    if let Some(name) = entry.get("name").and_then(|v| v.as_str()) {
                        if let Some(app_id) = entry.get("steam_app_id").and_then(|v| v.as_u64()) {
                            map.insert(app_id as u32, name.to_string());
                        }
                    }
                }
            }
        }
    }
    map
}

/// Build a name map from Steam's local appinfo.vdf binary cache.
/// Uses the fixed ReadPropertyTable parser — covers ALL Steam apps.
fn build_appinfo_name_map() -> std::collections::HashMap<u32, String> {
    let mut map = std::collections::HashMap::new();
    if let Ok(install) = steam_sdk::local::steam_path::detect_steam() {
        if let Ok(apps) = steam_sdk::local::steam_service::parse_appinfo_vdf(&install.path) {
            for app in apps {
                if let Some(name) = app.name {
                    map.insert(app.app_id, name);
                }
            }
        }
    }
    map
}

// ── Hidden games management ────────────────────────────────

fn hidden_games_path(tool_dir: &std::path::Path) -> std::path::PathBuf {
    tool_dir.join("hidden_games.json")
}

fn load_hidden_games(tool_dir: &std::path::Path) -> std::collections::HashSet<u32> {
    let path = hidden_games_path(tool_dir);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str::<Vec<u32>>(&content) {
                return list.into_iter().collect();
            }
        }
    }
    std::collections::HashSet::new()
}

fn save_hidden_games(tool_dir: &std::path::Path, list: &std::collections::HashSet<u32>) {
    let path = hidden_games_path(tool_dir);
    let v: Vec<u32> = list.iter().copied().collect();
    if let Ok(json) = serde_json::to_string_pretty(&v) {
        let _ = std::fs::write(&path, json);
    }
}

// ── Web API Inventory (requires API key) ────────────────────

#[tauri::command]
pub fn get_steam_inventory(state: State<AppState>) -> Result<Vec<OwnedGameDto>, String> {
    let api_key = get_api_key(&state)?;
    let steam_id = get_steam_id(&state)?;
    let client = shared_client();

    inventory::get_owned_games(&client, steam_id, &api_key, true, true)
        .map(|games| games.into_iter().map(OwnedGameDto::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_recently_played(state: State<AppState>) -> Result<Vec<OwnedGameDto>, String> {
    let api_key = get_api_key(&state)?;
    let steam_id = get_steam_id(&state)?;
    let client = shared_client();

    inventory::get_recently_played_games(&client, steam_id, &api_key)
        .map(|games| {
            games
                .into_iter()
                .map(|g| OwnedGameDto {
                    appid: g.appid,
                    name: g.name,
                    playtime_forever: g.playtime_forever,
                    playtime_2weeks: Some(g.playtime_2weeks),
                    img_icon_url: g.img_icon_url,
                    img_logo_url: g.img_logo_url,
                })
                .collect()
        })
        .map_err(|e| e.to_string())
}

// ── Achievements ─────────────────────────────────────────────

#[tauri::command]
pub fn get_game_achievements_summary(app_id: u32) -> Result<AchievementSummaryDto, String> {
    let entry = load_cached_achievements(app_id)?;
    let total = entry.achievements.len();
    let unlocked = entry
        .achievements
        .iter()
        .filter(|achievement| achievement.achieved)
        .count();

    Ok(AchievementSummaryDto {
        percentage: format!("{:.1}", entry.percentage),
        total,
        unlocked,
        has_achievements: total > 0,
    })
}

// ── Library stats & completion ───────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStatsDto {
    pub owned_count: usize,
    pub total_minutes: u64,
    pub avg_minutes: u64,
    /// Sum of current store prices (cents) for owned games; None when no
    /// priced game could be fetched.
    pub total_value_cents: Option<u64>,
    pub value_currency: Option<String>,
    /// Where the base game list came from: "web" (GetOwnedGames) or "local".
    pub source: String,
    /// Playtime distribution across hour buckets (game counts).
    pub distribution: Vec<DistributionBucketDto>,
    /// Top games by playtime (for the heatmap grid).
    pub top_games: Vec<TopGameDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributionBucketDto {
    pub label: String,
    pub games: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopGameDto {
    pub appid: u32,
    pub name: Option<String>,
    pub minutes: u64,
    pub icon_url: Option<String>,
}

/// Resolve the library game list: web inventory when an API key + Steam ID are
/// configured (covers non-installed games), otherwise local Steam files.
/// Returns `(source, (appid, name, minutes, icon_url) rows)`.
fn library_game_rows(state: &AppState) -> (String, Vec<(u32, Option<String>, u64, Option<String>)>) {
    let client = shared_client();
    match (get_api_key(state), get_steam_id(state)) {
        (Ok(key), Ok(steam_id)) => {
            let owned = inventory::get_owned_games(&client, steam_id, &key, true, true)
                .unwrap_or_default();
            let rows = owned
                .into_iter()
                .map(|g| (g.appid, g.name, g.playtime_forever, g.img_icon_url))
                .collect();
            ("web".to_string(), rows)
        }
        _ => {
            let local = local_inventory::get_local_games().unwrap_or_default();
            let rows = local
                .into_iter()
                .map(|g| (g.app_id, g.name, g.playtime_minutes, None))
                .collect();
            ("local".to_string(), rows)
        }
    }
}

const DIST_BOUNDS: [(&str, u64); 9] = [
    ("<1h", 60),
    ("1-5h", 300),
    ("5-10h", 600),
    ("10-20h", 1200),
    ("20-50h", 3000),
    ("50-100h", 6000),
    ("100-200h", 12000),
    ("200-500h", 30000),
    ("500h+", u64::MAX),
];

/// Account-level library stats: counts, playtime, estimated value and the
/// playtime distribution.
#[tauri::command]
pub async fn get_library_stats(state: State<'_, AppState>) -> Result<LibraryStatsDto, String> {
    let (source, games) = library_game_rows(&state);

    let owned_count = games.len();
    let total_minutes: u64 = games.iter().map(|(_, _, m, _)| *m).sum();
    let avg_minutes = if owned_count > 0 {
        total_minutes / owned_count as u64
    } else {
        0
    };

    // Value: fetch store prices for the top 100 games by playtime (CNY via the
    // pinned `cc=cn` store query). Free / unpriced games contribute nothing.
    let mut sorted = games.clone();
    sorted.sort_by(|a, b| b.2.cmp(&a.2));
    let top_apps: Vec<u32> = sorted.iter().take(100).map(|g| g.0).collect();
    let (total_value_cents, value_currency) = if top_apps.is_empty() {
        (None, None)
    } else {
        let mut sum = 0u64;
        let mut priced = false;
        let mut currency: Option<String> = None;
        if let Ok(details) = store::get_app_details(&shared_client(), &top_apps, "schinese") {
            for detail in details {
                if let Some(price) = detail.price {
                    sum += price.final_price;
                    priced = true;
                    currency.get_or_insert_with(|| price.currency.clone());
                }
            }
        }
        (if priced { Some(sum) } else { None }, currency)
    };

    let distribution = {
        let mut counts = vec![0usize; DIST_BOUNDS.len()];
        for (_, _, minutes, _) in &games {
            for (i, (_, bound)) in DIST_BOUNDS.iter().enumerate() {
                if *minutes < *bound {
                    counts[i] += 1;
                    break;
                }
            }
        }
        DIST_BOUNDS
            .iter()
            .enumerate()
            .map(|(i, (label, _))| DistributionBucketDto {
                label: label.to_string(),
                games: counts[i],
            })
            .collect()
    };

    let top_games = sorted
        .iter()
        .take(48)
        .map(|(appid, name, minutes, icon_url)| TopGameDto {
            appid: *appid,
            name: name.clone(),
            minutes: *minutes,
            icon_url: icon_url.clone(),
        })
        .collect();

    Ok(LibraryStatsDto {
        owned_count,
        total_minutes,
        avg_minutes,
        total_value_cents,
        value_currency,
        source,
        distribution,
        top_games,
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCompletionDto {
    pub app_id: u32,
    pub name: Option<String>,
    pub achieved: usize,
    pub total: usize,
    pub percent: f64,
    /// "web" (GetPlayerAchievements), "local" (local Steam client), "none".
    pub source: String,
}

/// Per-game achievement completion for the most-played games.
///
/// Uses `GetPlayerAchievements` (Web API, needs a key) first; falls back to
/// the local Steam client when the key is missing or the game has no visible
/// achievements; otherwise the game is reported as "none". Serial + throttled
/// to respect Web API rate limits.
#[tauri::command]
pub async fn get_library_completion(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<GameCompletionDto>, String> {
    let cap = (limit.unwrap_or(50) as usize).min(100);
    let (_, games) = library_game_rows(&state);
    let mut sorted = games;
    sorted.sort_by(|a, b| b.2.cmp(&a.2));
    let targets: Vec<(u32, Option<String>)> = sorted
        .into_iter()
        .take(cap)
        .map(|(appid, name, _, _)| (appid, name))
        .collect();

    let client = shared_client();
    let api_key = get_api_key(&state).ok();
    let steam_id = get_steam_id(&state).ok();

    let mut results = Vec::with_capacity(targets.len());
    for (app_id, name) in targets {
        let mut item = GameCompletionDto {
            app_id,
            name,
            achieved: 0,
            total: 0,
            percent: 0.0,
            source: "none".into(),
        };

        if let (Some(key), Some(sid)) = (&api_key, &steam_id) {
            if let Ok((_, list)) =
                steam_sdk::client::achievements::get_achievements_with_info(&client, *sid, app_id, key)
            {
                if !list.is_empty() {
                    let total = list.len();
                    let achieved = list.iter().filter(|a| a.achieved).count();
                    item.achieved = achieved;
                    item.total = total;
                    item.percent = (achieved as f64 / total as f64) * 100.0;
                    item.source = "web".into();
                    results.push(item);
                    continue;
                }
            }
            // Polite throttle between Web API calls.
            std::thread::sleep(std::time::Duration::from_millis(80));
        }

        // Local Steam client fallback (Windows, requires Steam running).
        if let Ok((_, list, live_available, _)) =
            steam_sdk::client::achievements::get_achievements_local_first(&client, 0, app_id)
        {
            if live_available && !list.is_empty() {
                let total = list.len();
                let achieved = list.iter().filter(|a| a.achieved).count();
                item.achieved = achieved;
                item.total = total;
                item.percent = (achieved as f64 / total as f64) * 100.0;
                item.source = "local".into();
                results.push(item);
                continue;
            }
        }

        results.push(item);
    }
    Ok(results)
}

#[tauri::command]
pub fn get_game_achievements(
    _state: State<AppState>,
    app_id: u32,
    filter: Option<String>,
    sort: Option<String>,
) -> Result<serde_json::Value, String> {
    let entry = load_cached_achievements(app_id)?;

    let mut dto: Vec<AchievementInfoDto> = entry
        .achievements
        .into_iter()
        .map(AchievementInfoDto::from)
        .collect();

    // Stats computed on the full list before filtering
    let total = dto.len();
    let unlocked = dto.iter().filter(|a| a.achieved).count();

    // Apply filter
    match filter.as_deref() {
        Some("unlocked") => dto.retain(|a| a.achieved),
        Some("locked") => dto.retain(|a| !a.achieved),
        _ => {} // "all" or None — no filtering
    }

    // Apply sort
    match sort.as_deref() {
        Some("name") => dto.sort_by(|a, b| a.display_name.cmp(&b.display_name)),
        Some("recent") => dto.sort_by(|a, b| b.unlock_time.cmp(&a.unlock_time)),
        _ => {} // "default" or None — keep original order
    }

    Ok(serde_json::json!({
        "percentage": format!("{:.1}", entry.percentage),
        "total": total,
        "unlocked": unlocked,
        "achievements": dto,
        "liveStateAvailable": entry.live_state_available,
        "liveStateError": entry.live_state_error,
        "hasAchievements": total > 0,
    }))
}

// ── User Info (from mini-profile API) ───────────────────────

/// Get Steam user info (avatar, persona name) from the mini-profile API.
/// This is the same endpoint SteamTools uses for account avatars.
///
/// Served from a per-account file cache with stale-while-revalidate: a fresh
/// entry (≤10 min) returns instantly, a stale entry (≤24 h) is served
/// immediately while a background thread refreshes it, and only a cold miss
/// blocks on the network. Profile data changes rarely, so entering the Steam
/// page no longer pays a cross-region request every time.
///
/// `steam_id64` is a string because SteamID64 exceeds JS safe-integer range.
const PROFILE_CACHE_TTL_SECS: u64 = 10 * 60;
const PROFILE_STALE_MAX_SECS: u64 = 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedProfile {
    #[serde(flatten)]
    data: serde_json::Value,
    fetched_at: u64,
}

static PROFILE_CACHE_LOCK: Mutex<()> = Mutex::new(());

fn profile_cache_path(tool_dir: &Path) -> std::path::PathBuf {
    tool_dir.join("steam_profile_cache.json")
}

fn load_profile_cache(path: &Path, steam_id: &str) -> Option<CachedProfile> {
    let content = std::fs::read_to_string(path).ok()?;
    let map: serde_json::Value = serde_json::from_str(&content).ok()?;
    serde_json::from_value(map.get(steam_id)?.clone()).ok()
}

fn save_profile_cache(path: &Path, steam_id: &str, entry: &CachedProfile) {
    let _guard = PROFILE_CACHE_LOCK.lock().unwrap();
    let mut map = std::fs::read_to_string(path)
        .ok()
        .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    map[steam_id] = serde_json::to_value(entry).unwrap_or(serde_json::Value::Null);
    if let Ok(json) = serde_json::to_string_pretty(&map) {
        let _ = std::fs::write(path, json);
    }
}

fn fetch_user_info(client: &SteamHttpClient, sid: u64) -> Result<serde_json::Value, String> {
    let info = steam_sdk::client::steamworks_web_api::get_user_info(client, sid)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "steamId64": info.steam_id64.to_string(),
        "personaName": info.persona_name,
        "avatarUrl": info.avatar_url,
        "level": info.level,
        "inGameName": info.in_game_name,
    }))
}

#[tauri::command]
pub async fn get_steam_user_info(
    state: State<'_, AppState>,
    steam_id64: String,
) -> Result<serde_json::Value, String> {
    let sid: u64 = steam_id64
        .parse()
        .map_err(|_| format!("Invalid Steam ID: {}", steam_id64))?;
    let path = profile_cache_path(&state.tool_dir);
    let now = chrono::Utc::now().timestamp() as u64;

    if let Some(cached) = load_profile_cache(&path, &steam_id64) {
        let age = now.saturating_sub(cached.fetched_at);
        if age < PROFILE_CACHE_TTL_SECS {
            return Ok(cached.data);
        }
        if age < PROFILE_STALE_MAX_SECS {
            // Serve stale now, refresh in the background so the next visit
            // is instant again.
            let client = shared_client();
            let path = path.clone();
            let steam_id = steam_id64.clone();
            std::thread::spawn(move || {
                if let Ok(info) = fetch_user_info(&client, sid) {
                    save_profile_cache(
                        &path,
                        &steam_id,
                        &CachedProfile {
                            data: info,
                            fetched_at: chrono::Utc::now().timestamp() as u64,
                        },
                    );
                }
            });
            return Ok(cached.data);
        }
    }

    // Cold miss — block on the network once.
    let info = fetch_user_info(&shared_client(), sid)?;
    save_profile_cache(
        &path,
        &steam_id64,
        &CachedProfile {
            data: info.clone(),
            fetched_at: now,
        },
    );
    Ok(info)
}

// ── Download Monitoring ─────────────────────────────────────
//
// Translated from SteamTools SteamApp.cs download state model:
//   IsInstalled      = IsBitSet(State, 2)
//   CheckDownloading = (IsBitSet(State, 1) || IsBitSet(State, 10)) && !IsBitSet(State, 9)
//
// Progress is read directly from Steam's ACF file:
//   Progress = BytesDownloaded / BytesToDownload * 100
//
// This is the same approach SteamTools uses. Steam writes BytesDownloaded
// and StateFlags to the ACF periodically during active downloads.

/// DTO for a downloading Steam game.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadingGameDto {
    pub app_id: u32,
    pub name: Option<String>,
    /// ACF installdir value (folder name, not full path)
    pub install_dir: Option<String>,
    /// ACF StateFlags
    pub state_flags: u32,
    /// ACF SizeOnDisk — total expected installed size
    pub size_on_disk: u64,
    /// ACF BytesDownloaded — compressed bytes downloaded so far
    pub bytes_downloaded: u64,
    /// ACF BytesToDownload — total compressed download size
    pub bytes_to_download: u64,
    /// ACF BytesStaged
    pub bytes_staged: u64,
    /// ACF BytesToStage
    pub bytes_to_stage: u64,
}

/// Tracked download entry in pending_downloads.json
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TrackedDownload {
    app_id: u32,
    name: Option<String>,
    started_at: String,
}

static INSTALL_THROTTLE: OnceLock<Mutex<HashMap<u32, Instant>>> = OnceLock::new();
const INSTALL_THROTTLE_WINDOW: Duration = Duration::from_secs(3);

fn install_throttle_map() -> &'static Mutex<HashMap<u32, Instant>> {
    INSTALL_THROTTLE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn should_throttle_install(app_id: u32) -> bool {
    let now = Instant::now();
    let mut installs = install_throttle_map().lock().unwrap();
    installs.retain(|_, ts| now.duration_since(*ts) < INSTALL_THROTTLE_WINDOW);

    if let Some(last) = installs.get(&app_id) {
        if now.duration_since(*last) < INSTALL_THROTTLE_WINDOW {
            return true;
        }
    }

    installs.insert(app_id, now);
    false
}

fn pending_downloads_path(tool_dir: &std::path::Path) -> std::path::PathBuf {
    tool_dir.join("pending_downloads.json")
}

fn load_pending_downloads(tool_dir: &std::path::Path) -> Vec<TrackedDownload> {
    let path = pending_downloads_path(tool_dir);
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str::<Vec<TrackedDownload>>(&content) {
                return list;
            }
        }
    }
    Vec::new()
}

fn save_pending_downloads(tool_dir: &std::path::Path, list: &[TrackedDownload]) {
    let path = pending_downloads_path(tool_dir);
    if let Ok(json) = serde_json::to_string_pretty(list) {
        let _ = std::fs::write(&path, json);
    }
}

/// Register a download initiated from this app.
///
/// This only records the pending download so Download Manager can track it.
/// The caller is responsible for triggering the actual `steam://install/...` action.
#[tauri::command]
pub fn register_download(
    state: State<AppState>,
    app_id: u32,
    name: Option<String>,
) -> Result<(), String> {
    let mut list = load_pending_downloads(&state.tool_dir);
    if !list.iter().any(|d| d.app_id == app_id) {
        list.push(TrackedDownload {
            app_id,
            name,
            started_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        });
        save_pending_downloads(&state.tool_dir, &list);
    }
    Ok(())
}

/// Start a Steam install in a SteamTools-like single action.
///
/// Repeated clicks on the same app within a very short window are ignored,
/// but an older pending entry must not block a legitimate install attempt.
#[tauri::command]
pub fn start_steam_install(
    state: State<AppState>,
    app_id: u32,
    name: Option<String>,
) -> Result<String, String> {
    use steam_sdk::local::download::check_downloading;

    if let Ok(apps) = steam_sdk::local::download::get_downloading_app_list() {
        if let Some(app) = apps.iter().find(|app| app.app_id == app_id) {
            if check_downloading(app.state) {
                return Ok("already_downloading".into());
            }
            if (app.state & 4) != 0 {
                return Ok("already_installed".into());
            }
        }
    }

    if should_throttle_install(app_id) {
        return Ok("throttled".into());
    }

    register_download(state, app_id, name)?;
    open_external_url(&format!("steam://install/{}", app_id))?;
    Ok("started".into())
}

/// Parse an ACF file using steam-sdk's VDF parser.
/// Translated from SteamTools `FileToAppInfo()` which calls `VdfHelper.Read()`.
fn file_to_app_info(path: &std::path::Path) -> Result<DownloadingGameDto, String> {
    let app = steam_sdk::local::download::file_to_app_info(path).map_err(|e| e.to_string())?;

    Ok(DownloadingGameDto {
        app_id: app.app_id,
        name: app.name,
        install_dir: app.install_dir,
        state_flags: app.state as u32,
        size_on_disk: app.size_on_disk as u64,
        bytes_downloaded: app.bytes_downloaded as u64,
        bytes_to_download: app.bytes_to_download as u64,
        bytes_staged: app.bytes_staged as u64,
        bytes_to_stage: app.bytes_to_stage as u64,
    })
}

/// Get currently downloading games — only those initiated from this app.
///
/// Translated from SteamTools `GetDownloadingAppList()`.
/// Reads ACF files using the VDF parser (same as SteamTools `VdfHelper.Read()`).
///
/// Progress = bytesDownloaded / bytesToDownload * 100
#[tauri::command]
pub fn get_downloading_games(state: State<AppState>) -> Result<Vec<DownloadingGameDto>, String> {
    let pending = load_pending_downloads(&state.tool_dir);
    if pending.is_empty() {
        return Ok(Vec::new());
    }

    let pending_ids: std::collections::HashSet<u32> = pending.iter().map(|d| d.app_id).collect();
    let mut result: Vec<DownloadingGameDto> = Vec::new();

    // ── Translated from GetDownloadingAppList() ──
    let apps = steam_sdk::local::download::get_downloading_app_list().map_err(|e| e.to_string())?;

    for app in apps {
        if app.app_id > 0 && pending_ids.contains(&app.app_id) {
            let mut dto = DownloadingGameDto {
                app_id: app.app_id,
                name: app.name,
                install_dir: app.install_dir,
                state_flags: app.state as u32,
                size_on_disk: app.size_on_disk as u64,
                bytes_downloaded: app.bytes_downloaded as u64,
                bytes_to_download: app.bytes_to_download as u64,
                bytes_staged: app.bytes_staged as u64,
                bytes_to_stage: app.bytes_to_stage as u64,
            };

            if dto.name.is_none() {
                dto.name = pending
                    .iter()
                    .find(|d| d.app_id == app.app_id)
                    .and_then(|d| d.name.clone());
            }

            // Deduplicate: keep entry with more bytes downloaded
            if let Some(existing) = result.iter_mut().find(|g| g.app_id == app.app_id) {
                if dto.bytes_downloaded > existing.bytes_downloaded {
                    *existing = dto;
                }
            } else {
                result.push(dto);
            }
        }
    }

    // Clean up completed downloads — same SteamTools bit logic
    use steam_sdk::local::download::check_downloading;
    fn is_installed(flags: u32) -> bool {
        (flags & 4) != 0
    }

    let completed_ids: std::collections::HashSet<u32> = result
        .iter()
        .filter(|g| is_installed(g.state_flags) && !check_downloading(g.state_flags as i32))
        .map(|g| g.app_id)
        .collect();

    if !completed_ids.is_empty() {
        let cleaned: Vec<TrackedDownload> = pending
            .into_iter()
            .filter(|d| !completed_ids.contains(&d.app_id))
            .collect();
        save_pending_downloads(&state.tool_dir, &cleaned);
    }

    Ok(result)
}

fn open_external_url(url: &str) -> Result<(), String> {
    // SteamTools opens protocol URLs via ShellExecute / UseShellExecute=true,
    // not through `cmd /c start`. Follow the same approach to avoid shell
    // argument quirks and protocol-handler misrouting.
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::Shell::ShellExecuteA;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let operation = CString::new("open").map_err(|e| format!("Invalid operation: {}", e))?;
        let target = CString::new(url).map_err(|e| format!("Invalid URL: {}", e))?;

        let result = unsafe {
            ShellExecuteA(
                std::ptr::null_mut(),
                operation.as_ptr() as *const u8,
                target.as_ptr() as *const u8,
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;

        if result <= 32 {
            return Err(format!("Failed to open URL via ShellExecute: {}", result));
        }
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    Ok(())
}

/// Open a URL or steam:// protocol link with the OS default handler.
/// Works around Tauri webview not handling custom protocol links.
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    open_external_url(&url)
}

// ── Game management (translated from SteamTools GameListPageViewModel) ──

/// Toggle hide/show a game in the inventory list.
/// Translated from SteamTools `AddHideAppList()` / `ShowHideAppCommand`.
#[tauri::command]
pub fn toggle_hide_game(state: State<AppState>, app_id: u32) -> Result<bool, String> {
    let mut hidden = load_hidden_games(&state.tool_dir);
    if hidden.contains(&app_id) {
        hidden.remove(&app_id);
        save_hidden_games(&state.tool_dir, &hidden);
        Ok(false) // now shown
    } else {
        hidden.insert(app_id);
        save_hidden_games(&state.tool_dir, &hidden);
        Ok(true) // now hidden
    }
}

fn steam_game_names_path(tool_dir: &std::path::Path) -> std::path::PathBuf {
    tool_dir.join("steam_game_names.json")
}

fn load_custom_game_names(tool_dir: &std::path::Path) -> std::collections::HashMap<u32, String> {
    let path = steam_game_names_path(tool_dir);
    if path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_default())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    }
}

/// Edit a game's display name.
/// Translated from SteamTools `EditAppInfoClick()` / `SaveEditAppInfo()`.
/// The custom name is stored in the runtime data directory.
#[tauri::command]
pub fn edit_steam_game_info(
    state: State<AppState>,
    app_id: u32,
    name: String,
) -> Result<(), String> {
    let path = steam_game_names_path(&state.tool_dir);
    let mut map = load_custom_game_names(&state.tool_dir);
    map.insert(app_id, name);
    let json = serde_json::to_string_pretty(&map).map_err(|e| format!("JSON error: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

/// Get custom game names (for merging into inventory display).
#[tauri::command]
pub fn get_custom_game_names(
    state: State<AppState>,
) -> Result<std::collections::HashMap<u32, String>, String> {
    Ok(load_custom_game_names(&state.tool_dir))
}

/// Open Steam's cloud archive manager for a game.
/// Translated from SteamTools `ManageCloudArchive_Click()`.
#[tauri::command]
pub fn open_steam_cloud_manager(app_id: u32) -> Result<(), String> {
    let install = steam_sdk::local::steam_path::detect_steam().map_err(|e| e.to_string())?;
    let steam_exe = install.path.join(if cfg!(target_os = "windows") {
        "steam.exe"
    } else {
        "steam"
    });
    if !steam_exe.exists() {
        return Err("Steam executable not found".into());
    }
    std::process::Command::new(&steam_exe)
        .args(["-clt", "app", "-cloudmanager", "-id", &app_id.to_string()])
        .spawn()
        .map_err(|e| format!("Failed to start Steam cloud manager: {}", e))?;
    Ok(())
}

/// DTO for a save file location (matching SteamTools SteamAppSaveFile).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileDto {
    pub root: String,
    pub path: String,
    pub pattern: String,
    pub recursive: bool,
    /// Resolved full directory path (e.g. C:\Users\...\Saved Games\GameName)
    pub resolved_path: Option<String>,
}

/// Get save file locations for a game from appinfo.vdf.
/// Translated from SteamTools `SteamAppSaveFile` model + `FormatPathGenerate()`.
#[tauri::command]
pub fn get_game_save_files(app_id: u32) -> Result<Vec<SaveFileDto>, String> {
    let steam_dir = steam_sdk::local::steam_path::detect_steam().map_err(|e| e.to_string())?;
    let appinfo_path = steam_dir.path.join("appcache").join("appinfo.vdf");
    if !appinfo_path.exists() {
        return Ok(Vec::new());
    }

    // Parse appinfo.vdf for this app's ufs/savefiles
    let apps = steam_sdk::local::steam_service::parse_appinfo_vdf(&steam_dir.path)
        .map_err(|e| e.to_string())?;

    // Find the target app
    let app = match apps.iter().find(|a| a.app_id == app_id) {
        Some(a) => a,
        None => return Ok(Vec::new()),
    };

    // Read the full binary to extract savefiles (simple approach: re-parse for save files)
    // For now, return empty — the full save file parsing from binary appinfo is complex
    // TODO: implement full binary extraction of ufs/savefiles section

    let _ = app; // reserved
    Ok(Vec::new())
}

/// Set a custom cover image for a game by copying the file to Steam's grid folder.
/// Translated from SteamTools `SaveAppImageToSteamFile()`.
#[tauri::command]
pub fn set_game_cover_image(app_id: u32, image_path: String) -> Result<(), String> {
    let steam_dir = steam_sdk::local::steam_path::detect_steam().map_err(|e| e.to_string())?;

    // Find the most recent user's steam_id32 from loginusers.vdf
    let steam_id32 = {
        let loginusers = steam_dir.path.join("config").join("loginusers.vdf");
        if loginusers.exists() {
            if let Ok(content) = std::fs::read_to_string(&loginusers) {
                if let Ok(vdf) = steam_sdk::vdf::parse_vdf(&content) {
                    if let Some(users) = vdf.get("users").and_then(|u| u.as_map()) {
                        users
                            .iter()
                            .filter_map(|(steam_id64, data)| {
                                let most_recent = data
                                    .get("MostRecent")
                                    .or_else(|| data.get("mostrecent"))
                                    .and_then(|v| v.as_str())
                                    .and_then(|s| s.parse::<i32>().ok())
                                    .unwrap_or(0);
                                if most_recent == 1 {
                                    let id64: u64 = steam_id64.parse().ok()?;
                                    Some((id64 & 0xFFFF_FFFF) as u32)
                                } else {
                                    None
                                }
                            })
                            .next()
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    }
    .unwrap_or(0);

    if steam_id32 == 0 {
        return Err("No active Steam user found. Please log in to Steam first.".into());
    }

    let grid_dir = steam_dir
        .path
        .join("userdata")
        .join(steam_id32.to_string())
        .join("config")
        .join("grid");

    std::fs::create_dir_all(&grid_dir).map_err(|e| format!("Failed to create grid dir: {}", e))?;

    let src = std::path::PathBuf::from(&image_path);
    if !src.exists() {
        return Err(format!("Image file not found: {}", image_path));
    }

    // Copy as grid cover (like SteamTools Grid type: {appId}p.png)
    let dest = grid_dir.join(format!("{}p.png", app_id));
    std::fs::copy(&src, &dest).map_err(|e| format!("Failed to copy cover: {}", e))?;

    Ok(())
}

// ── Config ───────────────────────────────────────────────────

#[tauri::command]
pub fn set_steam_api_key(state: State<AppState>, api_key: String) -> Result<(), String> {
    let mut config = load_config(&state)?;
    config.steam_api_key = api_key;
    save_config(&state, &config)
}
