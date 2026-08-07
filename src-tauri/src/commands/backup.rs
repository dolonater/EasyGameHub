use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInfoDto {
    pub game_name: String,
    pub path: String,
    pub timestamp: String,
    pub note: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn backup_now(
    state: tauri::State<'_, AppState>,
    game_id: String,
    note: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<SnapshotInfoDto, String> {
    // Find the game
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;
    let game = games
        .iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| format!("Game not found: {}", game_id))?;

    // Check disk space limit
    let cfg = crate::core::config::load_config(&state.config_path).unwrap_or_default();
    if cfg.max_backup_size_gb > 0 {
        let total = crate::core::backup::get_total_backup_size(&state.backup_root);
        let limit = cfg.max_backup_size_gb * 1024 * 1024 * 1024;
        if total >= limit {
            return Err(format!(
                "备份总大小已达到上限（{}GB），请删除旧备份或调高上限后再试。",
                cfg.max_backup_size_gb
            ));
        }
    }

    let save_dir = std::path::PathBuf::from(&game.save_path);
    if !save_dir.exists() {
        return Err(format!(
            "存档目录不存在: {}\n\n请确认游戏至少运行过一次，或手动修改存档路径。",
            save_dir.display()
        ));
    }

    let snap = crate::core::backup::create_snapshot(
        &game.name,
        &save_dir,
        &state.backup_root,
        note.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    // Verify
    if !crate::core::backup::verify_snapshot(&std::path::PathBuf::from(&snap.path), &save_dir)
        .unwrap_or(false)
    {
        return Err("Snapshot verification failed".into());
    }

    let dto = SnapshotInfoDto {
        game_name: snap.game_name,
        path: snap.path,
        timestamp: snap.timestamp,
        note: snap.note,
        size_bytes: snap.size_bytes,
    };

    // Emit event to frontend
    let _ = app_handle.emit("backup:completed", &dto);

    Ok(dto)
}

#[tauri::command]
pub fn get_snapshots(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<Vec<SnapshotInfoDto>, String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;
    let game = games
        .iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| format!("Game not found: {}", game_id))?;

    let snaps =
        crate::core::backup::get_snapshots(&game.name, &state.backup_root).unwrap_or_default();

    Ok(snaps
        .into_iter()
        .map(|s| SnapshotInfoDto {
            game_name: s.game_name,
            path: s.path,
            timestamp: s.timestamp,
            note: s.note,
            size_bytes: s.size_bytes,
        })
        .collect())
}

#[tauri::command]
pub fn delete_snapshot(
    _state: tauri::State<'_, AppState>,
    snapshot_path: String,
) -> Result<(), String> {
    crate::core::backup::delete_snapshot(&std::path::PathBuf::from(&snapshot_path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn edit_note(
    _state: tauri::State<'_, AppState>,
    snapshot_path: String,
    note: String,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(&snapshot_path);
    if !path.exists() {
        return Err("Snapshot file not found".into());
    }

    // Rename the ZIP file to update the note
    let parent = path.parent().unwrap();
    let stem = path.file_stem().unwrap().to_string_lossy();

    // Parse existing timestamp from filename
    let ts = if stem.len() >= 19 { &stem[..19] } else { &stem };

    let new_name = if note.is_empty() {
        format!("{}.zip", ts)
    } else {
        format!("{}_{}.zip", ts, note)
    };
    let new_path = parent.join(&new_name);

    std::fs::rename(&path, &new_path).map_err(|e| e.to_string())?;

    Ok(())
}

// ─────── Watcher control ───────

#[tauri::command]
pub fn start_watcher(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    let cfg = crate::core::config::load_config(&state.config_path).map_err(|e| e.to_string())?;

    let games = crate::load_watched_games(
        &state.db_path,
        &state.games_index_path,
        &state.custom_games_path,
        &state.user_games_path,
        &state.backup_root,
    );

    let mut w = state.watcher.lock().unwrap();
    w.update_config(crate::core::watcher::WatcherConfig {
        debounce_seconds: cfg.debounce_seconds,
        min_interval_minutes: cfg.min_interval_minutes,
    });
    w.start(games.clone()).map_err(|e| e.to_string())?;

    let mut s = state.scheduler.lock().unwrap();
    s.update_games(games);
    s.start();

    Ok(())
}

#[tauri::command]
pub fn stop_watcher(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    state.watcher.lock().unwrap().stop();
    state.scheduler.lock().unwrap().stop();
    Ok(())
}

#[tauri::command]
pub fn set_periodic_backup(
    state: tauri::State<'_, crate::AppState>,
    minutes: u64,
) -> Result<(), String> {
    state
        .scheduler
        .lock()
        .unwrap()
        .set_periodic_minutes(minutes);
    Ok(())
}

#[tauri::command]
pub fn set_daily_backup_time(
    state: tauri::State<'_, crate::AppState>,
    time: Option<String>,
) -> Result<(), String> {
    state.scheduler.lock().unwrap().set_daily_time(time);
    Ok(())
}

// ─────── Batch operations ───────

#[tauri::command]
pub fn batch_backup(
    state: tauri::State<'_, crate::AppState>,
    game_ids: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;

    for gid in &game_ids {
        if let Some(game) = games.iter().find(|g| g.id == *gid) {
            let save_dir = std::path::PathBuf::from(&game.save_path);
            if save_dir.exists() {
                crate::core::backup::create_snapshot(
                    &game.name,
                    &save_dir,
                    &state.backup_root,
                    None,
                )
                .map_err(|e| format!("Batch backup failed for {}: {}", game.name, e))?;
            }
        }
    }

    let _ = app_handle.emit(
        "backup:completed",
        serde_json::json!({
            "event": "backup:completed",
            "game_name": format!("{} games", game_ids.len()),
        }),
    );

    Ok(())
}

#[tauri::command]
pub fn batch_restore(
    state: tauri::State<'_, crate::AppState>,
    game_ids: Vec<String>,
) -> Result<(), String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;

    for gid in &game_ids {
        if let Some(game) = games.iter().find(|g| g.id == *gid) {
            // Get the latest snapshot
            let snaps = crate::core::backup::get_snapshots(&game.name, &state.backup_root)
                .unwrap_or_default();
            if let Some(latest) = snaps.first() {
                let snap_path = std::path::PathBuf::from(&latest.path);
                let target = std::path::PathBuf::from(&game.save_path);
                crate::core::restore::restore_snapshot(
                    &snap_path,
                    &target,
                    &state.backup_root,
                    &game.name,
                )
                .map_err(|e| format!("Batch restore failed for {}: {}", game.name, e))?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn batch_delete_snapshots(
    state: tauri::State<'_, crate::AppState>,
    game_ids: Vec<String>,
) -> Result<(), String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;

    for gid in &game_ids {
        if let Some(game) = games.iter().find(|g| g.id == *gid) {
            let snaps = crate::core::backup::get_snapshots(&game.name, &state.backup_root)
                .unwrap_or_default();
            for snap in &snaps {
                let _ = crate::core::backup::delete_snapshot(&std::path::PathBuf::from(&snap.path));
            }
        }
    }

    Ok(())
}

// ─────── Snapshot browser ───────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZipEntryInfo {
    pub name: String,
    pub is_dir: bool,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn list_zip_contents(snapshot_path: String) -> Result<Vec<ZipEntryInfo>, String> {
    let path = std::path::PathBuf::from(&snapshot_path);
    let file = std::fs::File::open(&path).map_err(|e| format!("Cannot open: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {}", e))?;

    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("Read entry: {}", e))?;
        entries.push(ZipEntryInfo {
            name: entry.name().to_string(),
            is_dir: entry.is_dir(),
            size_bytes: entry.size(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub fn read_zip_file(snapshot_path: String, file_path: String) -> Result<String, String> {
    let path = std::path::PathBuf::from(&snapshot_path);
    let file = std::fs::File::open(&path).map_err(|e| format!("Cannot open: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {}", e))?;

    let mut entry = archive
        .by_name(&file_path)
        .map_err(|e| format!("File not in ZIP: {}", e))?;
    use std::io::Read;
    let mut buf = Vec::new();
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("Read error: {}", e))?;

    String::from_utf8(buf).map_err(|_| "Binary file, preview not available".to_string())
}
