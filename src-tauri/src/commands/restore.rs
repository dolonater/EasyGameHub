use crate::AppState;
use tauri::Emitter;

#[tauri::command]
pub fn restore_snapshot(
    state: tauri::State<'_, AppState>,
    game_id: String,
    snapshot_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;
    let game = games
        .iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| format!("Game not found: {}", game_id))?;

    let target_dir = std::path::PathBuf::from(&game.save_path);
    let snap_path = std::path::PathBuf::from(&snapshot_path);

    crate::core::restore::restore_snapshot(&snap_path, &target_dir, &state.backup_root, &game.name)
        .map_err(|e| e.to_string())?;

    let _ = app_handle.emit(
        "backup:completed",
        serde_json::json!({
            "game": game.name,
            "note": "恢复完成 — 已自动创建恢复前安全快照"
        }),
    );

    Ok(())
}
