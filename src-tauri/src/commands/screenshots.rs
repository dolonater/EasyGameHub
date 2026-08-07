use crate::AppState;
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotFile {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub modified_at: Option<String>,
}

fn build_screenshot_file(path: &Path) -> ScreenshotFile {
    let metadata = path.metadata().ok();
    let modified_at = metadata.as_ref().and_then(|m| m.modified().ok()).map(|ts| {
        let dt: DateTime<Local> = ts.into();
        dt.format("%Y-%m-%d %H:%M:%S").to_string()
    });

    ScreenshotFile {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: path.to_string_lossy().to_string(),
        size_bytes: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
        modified_at,
    }
}

fn collect_screenshot_paths(
    game_id: &str,
    steam_app_id: Option<u32>,
    user_games: &crate::core::db::UserGames,
) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    for src in &user_games.screenshot_sources {
        if src.game_id != game_id {
            continue;
        }
        let dir = PathBuf::from(&src.directory);
        if dir.exists() {
            paths.extend(crate::core::steam_sync::scan_screenshots_dir(&dir));
        }
    }

    if let Some(steam_id) = steam_app_id {
        let steam_dirs = crate::core::steam_sync::find_steam_screenshot_dirs(steam_id);
        for (_, dir) in steam_dirs {
            if dir.exists() {
                paths.extend(crate::core::steam_sync::scan_screenshots_dir(&dir));
            }
        }
    }

    paths
}

fn build_sorted_screenshot_files(paths: Vec<PathBuf>) -> Vec<ScreenshotFile> {
    let mut files: Vec<ScreenshotFile> = paths
        .into_iter()
        .map(|p| build_screenshot_file(&p))
        .collect();
    files.sort_by(|a, b| match (&a.modified_at, &b.modified_at) {
        (Some(am), Some(bm)) => bm.cmp(am).then_with(|| b.name.cmp(&a.name)),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => b.name.cmp(&a.name),
    });
    files
}

/// Get screenshots for a game. Scans both Steam and custom directories.
#[tauri::command]
pub fn get_screenshots(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<Vec<ScreenshotFile>, String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Games error: {}", e))?;
    let game = games
        .iter()
        .find(|g| g.id == game_id)
        .ok_or("Game not found")?;

    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    Ok(build_sorted_screenshot_files(collect_screenshot_paths(
        &game_id,
        game.steam_app_id,
        &user_games,
    )))
}

/// Delete a screenshot file from disk.
#[tauri::command]
pub fn delete_screenshot(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    if !path.exists() {
        return Err("Screenshot file not found".into());
    }

    let metadata = path.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("Screenshot path is not a file".into());
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    let is_supported_image = matches!(
        ext.as_deref(),
        Some("png" | "jpg" | "jpeg" | "bmp" | "gif" | "webp")
    );
    if !is_supported_image {
        return Err("Screenshot file type is not supported".into());
    }

    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete screenshot: {}", e))?;

    Ok(())
}

/// Add a custom screenshot directory for a game.
#[tauri::command]
pub fn add_screenshot_dir(
    state: tauri::State<'_, AppState>,
    game_id: String,
    directory: String,
) -> Result<(), String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    // Don't add duplicates
    if !user_games
        .screenshot_sources
        .iter()
        .any(|s| s.game_id == game_id && s.directory == directory)
    {
        user_games
            .screenshot_sources
            .push(crate::core::db::ScreenshotSource {
                game_id,
                source_type: "custom".into(),
                directory,
            });
    }

    crate::core::db::save_user_games(&state.user_games_path, &user_games).map_err(|e| e.to_string())
}

/// Get screenshot count per game (for sidebar badge).
#[tauri::command]
pub fn get_screenshot_counts(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<(String, usize)>, String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Games error: {}", e))?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for g in &games {
        let count = collect_screenshot_paths(&g.id, g.steam_app_id, &user_games).len();
        if count > 0 {
            result.push((g.id.clone(), count));
        }
    }
    Ok(result)
}
