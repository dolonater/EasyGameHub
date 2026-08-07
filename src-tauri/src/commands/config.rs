use crate::AppState;
use serde::{Deserialize, Serialize};
use std::io::Read;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundAssetDto {
    pub source_path: String,
    pub thumbnail_path: Option<String>,
    pub runtime_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettingsDto {
    pub preset: String,
    pub background_image: Option<String>,
    pub background_choice: String,
    pub custom_backgrounds: Vec<String>,
    #[serde(default)]
    pub custom_background_assets: Vec<BackgroundAssetDto>,
    pub follow_background_text: bool,
    pub use_liquid_glass: bool,
    pub auto_darken: bool,
    pub overlay_opacity: f64,
    pub background_blur: f64,
    pub surface_opacity: f64,
    pub surface_blur: f64,
    pub radius: f64,
    #[serde(default)]
    pub font_family: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigDto {
    pub backup_root: String,
    pub language: String,
    pub auto_backup: bool,
    pub debounce_seconds: u64,
    pub min_interval_minutes: u64,
    pub auto_start: bool,
    pub periodic_minutes: u64,
    pub max_backup_size_gb: u64,
    pub daily_backup_time: Option<String>,
    pub process_check_interval_seconds: u64,
    pub auto_backup_on_game_exit: bool,
    pub ui_animations: bool,
    pub steam_api_key: String,
    pub cached_steam_id: String,
    pub theme_mode: String,
    pub cover_card_style: String,
    pub appearance: AppearanceSettingsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub protected_games: usize,
    pub total_snapshots: usize,
    pub total_size_bytes: u64,
    pub last_backup: Option<String>,
    pub is_watching: bool,
    pub recent_activity: Vec<RecentActivityItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentActivityItem {
    pub game_name: String,
    pub action: String, // "backup" | "restore"
    pub timestamp: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn get_config(state: tauri::State<'_, AppState>) -> Result<ConfigDto, String> {
    let mut cfg =
        crate::core::config::load_config(&state.config_path).map_err(|e| e.to_string())?;
    let changed = crate::core::backgrounds::sync_background_assets(
        &state.background_thumbnails_dir,
        &state.background_runtime_dir,
        &mut cfg.appearance,
    )
    .map_err(|e| e.to_string())?;
    if changed {
        crate::core::config::save_config(&state.config_path, &cfg).map_err(|e| e.to_string())?;
    }
    Ok(ConfigDto {
        backup_root: cfg.backup_root,
        language: cfg.language,
        auto_backup: cfg.auto_backup,
        debounce_seconds: cfg.debounce_seconds,
        min_interval_minutes: cfg.min_interval_minutes,
        auto_start: cfg.auto_start,
        periodic_minutes: cfg.periodic_minutes,
        max_backup_size_gb: cfg.max_backup_size_gb,
        daily_backup_time: cfg.daily_backup_time.clone(),
        process_check_interval_seconds: cfg.process_check_interval_seconds,
        auto_backup_on_game_exit: cfg.auto_backup_on_game_exit,
        ui_animations: cfg.ui_animations,
        steam_api_key: cfg.steam_api_key.clone(),
        cached_steam_id: cfg.cached_steam_id.clone(),
        theme_mode: cfg.theme_mode.clone(),
        cover_card_style: cfg.cover_card_style.clone(),
        appearance: AppearanceSettingsDto {
            preset: cfg.appearance.preset.clone(),
            background_image: cfg.appearance.background_image.clone(),
            background_choice: cfg.appearance.background_choice.clone(),
            custom_backgrounds: cfg.appearance.custom_backgrounds.clone(),
            custom_background_assets: cfg
                .appearance
                .custom_background_assets
                .iter()
                .map(|asset| BackgroundAssetDto {
                    source_path: asset.source_path.clone(),
                    thumbnail_path: asset.thumbnail_path.clone(),
                    runtime_path: asset.runtime_path.clone(),
                })
                .collect(),
            follow_background_text: cfg.appearance.follow_background_text,
            use_liquid_glass: cfg.appearance.use_liquid_glass,
            auto_darken: cfg.appearance.auto_darken,
            overlay_opacity: cfg.appearance.overlay_opacity,
            background_blur: cfg.appearance.background_blur,
            surface_opacity: cfg.appearance.surface_opacity,
            surface_blur: cfg.appearance.surface_blur,
            radius: cfg.appearance.radius,
            font_family: cfg.appearance.font_family.clone(),
        },
    })
}

#[tauri::command]
pub fn update_config(state: tauri::State<'_, AppState>, dto: ConfigDto) -> Result<(), String> {
    let mut cfg = crate::core::config::Config {
        backup_root: dto.backup_root,
        language: dto.language,
        auto_backup: dto.auto_backup,
        debounce_seconds: dto.debounce_seconds,
        min_interval_minutes: dto.min_interval_minutes,
        auto_start: dto.auto_start,
        periodic_minutes: dto.periodic_minutes,
        max_backup_size_gb: dto.max_backup_size_gb,
        daily_backup_time: dto.daily_backup_time,
        process_check_interval_seconds: dto.process_check_interval_seconds,
        auto_backup_on_game_exit: dto.auto_backup_on_game_exit,
        ui_animations: dto.ui_animations,
        steam_api_key: dto.steam_api_key,
        cached_steam_id: dto.cached_steam_id,
        theme_mode: dto.theme_mode,
        cover_card_style: dto.cover_card_style,
        appearance: crate::core::config::AppearanceSettings {
            preset: dto.appearance.preset,
            background_image: dto.appearance.background_image,
            background_choice: dto.appearance.background_choice,
            custom_backgrounds: dto.appearance.custom_backgrounds,
            custom_background_assets: dto
                .appearance
                .custom_background_assets
                .into_iter()
                .map(|asset| crate::core::config::BackgroundAsset {
                    source_path: asset.source_path,
                    thumbnail_path: asset.thumbnail_path,
                    runtime_path: asset.runtime_path,
                })
                .collect(),
            follow_background_text: dto.appearance.follow_background_text,
            use_liquid_glass: dto.appearance.use_liquid_glass,
            auto_darken: dto.appearance.auto_darken,
            overlay_opacity: dto.appearance.overlay_opacity,
            background_blur: dto.appearance.background_blur,
            surface_opacity: dto.appearance.surface_opacity,
            surface_blur: dto.appearance.surface_blur,
            radius: dto.appearance.radius,
            font_family: if dto.appearance.font_family.trim().is_empty() {
                "%built-in".into()
            } else {
                dto.appearance.font_family
            },
        },
    };
    crate::core::backgrounds::sync_background_assets(
        &state.background_thumbnails_dir,
        &state.background_runtime_dir,
        &mut cfg.appearance,
    )
    .map_err(|e| e.to_string())?;
    crate::core::config::save_config(&state.config_path, &cfg).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(state: tauri::State<'_, AppState>) -> Result<Stats, String> {
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    let custom =
        crate::core::db::load_custom_games(&state.custom_games_path).map_err(|e| e.to_string())?;

    // Count monitored games — O(monitored) lookups instead of O(DB)
    let db_count = user_games
        .monitored
        .iter()
        .filter(|id| index.entries.contains_key(id.as_str()))
        .count();
    let custom_count = custom
        .games
        .iter()
        .filter(|cg| user_games.is_monitored(&cg.id))
        .count();
    let protected_games = db_count + custom_count;
    let mut total_snapshots = 0usize;
    let mut total_size_bytes = 0u64;
    let mut last_backup: Option<String> = None;
    let mut recent_activity: Vec<RecentActivityItem> = Vec::new();

    if state.backup_root.exists() {
        for game_entry in std::fs::read_dir(&state.backup_root).map_err(|e| e.to_string())? {
            let game_entry = game_entry.map_err(|e| e.to_string())?;
            if game_entry.path().is_dir() {
                let game_name = game_entry.file_name().to_string_lossy().to_string();
                let snaps = crate::core::backup::get_snapshots(&game_name, &state.backup_root)
                    .unwrap_or_default();
                total_snapshots += snaps.len();
                if let Some(s) = snaps.first() {
                    if last_backup.as_ref().map_or(true, |lb| s.timestamp > *lb) {
                        last_backup = Some(s.timestamp.clone());
                    }
                }
                for s in &snaps {
                    total_size_bytes += s.size_bytes;
                    let action = if s.note.contains("恢复前安全快照") || s.note.contains("safety")
                    {
                        "restore"
                    } else {
                        "backup"
                    };
                    recent_activity.push(RecentActivityItem {
                        game_name: game_name.clone(),
                        action: action.to_string(),
                        timestamp: s.timestamp.clone(),
                        size_bytes: s.size_bytes,
                    });
                }
            }
        }
    }

    // Sort by timestamp descending, take top 8
    recent_activity.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    recent_activity.truncate(8);

    let is_watching = state
        .watcher
        .lock()
        .map(|w| w.is_running())
        .unwrap_or(false);

    Ok(Stats {
        protected_games,
        total_snapshots,
        total_size_bytes,
        last_backup,
        is_watching,
        recent_activity,
    })
}

/// Result from checking for database updates.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DbUpdateInfo {
    pub has_update: bool,
    pub current_version: u32,
    pub latest_version: u32,
    pub download_url: Option<String>,
}

#[tauri::command]
pub fn check_db_update(state: tauri::State<'_, AppState>) -> Result<DbUpdateInfo, String> {
    // Read local version
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    let current_version = index.version;

    // Fetch latest release info from GitHub
    let owner = "doona";
    let repo = "gamesave-backup";
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        owner, repo
    );

    let response = ureq::get(&url)
        .set("User-Agent", "Doona-GameSave-Backup/0.1")
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("Network error: {}", e))?;

    let body = response
        .into_string()
        .map_err(|e| format!("Read error: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Parse error: {}", e))?;

    // Parse version from tag_name (e.g., "v2" or "db-v2")
    let tag = json["tag_name"]
        .as_str()
        .unwrap_or("")
        .trim_start_matches("db-v")
        .trim_start_matches('v');
    let latest_version: u32 = tag.parse().unwrap_or(0);

    let has_update = latest_version > current_version;

    // Find the games.db.json asset download URL
    let download_url = json["assets"].as_array().and_then(|assets| {
        assets.iter().find_map(|a| {
            if a["name"].as_str() == Some("games.db.json") {
                a["browser_download_url"].as_str().map(|s| s.to_string())
            } else {
                None
            }
        })
    });

    Ok(DbUpdateInfo {
        has_update,
        current_version,
        latest_version,
        download_url,
    })
}

#[tauri::command]
pub fn apply_db_update(state: tauri::State<'_, AppState>) -> Result<(), String> {
    // First check for update to get download URL
    let info = check_db_update(state.clone())?;
    let download_url = info
        .download_url
        .ok_or_else(|| "No download URL available".to_string())?;

    // Backup current file
    let bak_path = state.db_path.with_extension("json.bak");
    if state.db_path.exists() {
        std::fs::copy(&state.db_path, &bak_path).map_err(|e| format!("Failed to backup: {}", e))?;
    }

    // Download new file
    let response = ureq::get(&download_url)
        .set("User-Agent", "Doona-GameSave-Backup/0.1")
        .call()
        .map_err(|e| format!("Download error: {}", e))?;

    let mut bytes = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Read error: {}", e))?;

    // Validate it's valid JSON
    let _: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid JSON in update: {}", e))?;

    // Write new file
    std::fs::write(&state.db_path, &bytes).map_err(|e| format!("Write error: {}", e))?;

    // Rebuild index after DB update
    let _ = crate::core::db::rebuild_game_index(&state.db_path, &state.games_index_path);

    Ok(())
}

#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<String>, String> {
    let fonts = font_loader::system_fonts::query_all();
    Ok(fonts
        .into_iter()
        .map(|font| font.trim().to_string())
        .filter(|font| !font.is_empty())
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect())
}

// ─────── Auto-start via Windows registry ───────

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_NAME: &str = "EasyGameHub";

#[tauri::command]
pub fn get_auto_start() -> Result<bool, String> {
    use winreg::enums::*;
    let hkcu = winreg::RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey_with_flags(RUN_KEY, KEY_READ)
        .map_err(|e| e.to_string())?;
    Ok(key.get_value::<String, _>(APP_NAME).is_ok())
}

#[tauri::command]
pub fn set_auto_start(enable: bool) -> Result<(), String> {
    use winreg::enums::*;
    let hkcu = winreg::RegKey::predef(HKEY_CURRENT_USER);
    let (key, _disp) = hkcu
        .create_subkey_with_flags(RUN_KEY, KEY_WRITE)
        .map_err(|e| e.to_string())?;

    if enable {
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        key.set_value(APP_NAME, &exe_path.to_string_lossy().to_string())
            .map_err(|e| e.to_string())?;
    } else {
        let _ = key.delete_value(APP_NAME);
    }
    Ok(())
}
