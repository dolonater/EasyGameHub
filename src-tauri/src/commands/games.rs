use crate::AppState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameInfo {
    pub id: String,
    pub name: String,
    pub save_path: String,
    pub backup_dir: String,
    pub steam_app_id: Option<u32>,
    pub is_custom: bool,
    pub last_backup: Option<String>,
    pub snapshot_count: usize,
    pub status: String, // "active" | "inactive" | "unavailable"
    pub pinned: bool,
    pub auto_backup: bool,
}

fn build_game_info(
    id: String,
    name: String,
    save_path: String,
    steam_app_id: Option<u32>,
    is_custom: bool,
    backup_root: &std::path::Path,
    user_games: &crate::core::db::UserGames,
) -> GameInfo {
    // Check for path override first
    let effective_path = user_games
        .get_path_override(&id)
        .map(|s| s.to_string())
        .unwrap_or(save_path);
    let resolved = crate::core::db::resolve_save_path(&effective_path);
    let save_dir = std::path::PathBuf::from(&resolved);
    let is_available = save_dir.exists();

    let snaps = crate::core::backup::get_snapshots(&name, backup_root).unwrap_or_default();
    let last_backup = snaps.first().map(|s| s.timestamp.clone());
    let snapshot_count = snaps.len();

    let backup_dir = backup_root
        .join(crate::core::backup::sanitize_filename(&name))
        .to_string_lossy()
        .to_string();

    GameInfo {
        id: id.clone(),
        name,
        save_path: resolved,
        backup_dir,
        steam_app_id,
        is_custom,
        last_backup,
        snapshot_count,
        status: if is_available {
            "active"
        } else {
            "unavailable"
        }
        .into(),
        pinned: user_games.is_pinned(&id),
        auto_backup: user_games.auto_backup.iter().any(|a| a == &id),
    }
}

/// Lightweight build_game_info without snapshot scanning (for GameProfile).
fn build_game_info_light(
    id: String,
    name: String,
    save_path: String,
    steam_app_id: Option<u32>,
    is_custom: bool,
    user_games: &crate::core::db::UserGames,
) -> GameInfo {
    let effective_path = user_games
        .get_path_override(&id)
        .map(|s| s.to_string())
        .unwrap_or(save_path);
    let resolved = crate::core::db::resolve_save_path(&effective_path);
    let save_dir = std::path::PathBuf::from(&resolved);
    let is_available = save_dir.exists();

    let backup_dir = std::path::Path::new(".")
        .join(crate::core::backup::sanitize_filename(&name))
        .to_string_lossy()
        .to_string();

    GameInfo {
        id: id.clone(),
        name,
        save_path: resolved,
        backup_dir,
        steam_app_id,
        is_custom,
        last_backup: None,
        snapshot_count: 0,
        status: if is_available {
            "active"
        } else {
            "unavailable"
        }
        .into(),
        pinned: user_games.is_pinned(&id),
        auto_backup: user_games.auto_backup.iter().any(|a| a == &id),
    }
}

#[tauri::command]
pub fn scan_installed_games(state: tauri::State<'_, AppState>) -> Result<Vec<GameInfo>, String> {
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    let steam_path = crate::core::scanner::detect_steam_installation();
    let mut results: Vec<GameInfo> = Vec::new();

    if let Some(ref sp) = steam_path {
        let lib_paths = crate::core::scanner::parse_library_folders(sp);
        let app_ids = crate::core::scanner::parse_app_manifests(&lib_paths);
        let app_set: std::collections::HashSet<u32> = app_ids.into_iter().collect();

        for (id, entry) in &index.entries {
            if let Some(sid) = entry.steam_app_id {
                if app_set.contains(&sid) {
                    results.push(build_game_info(
                        id.clone(),
                        entry.name.clone(),
                        entry.save_path.clone(),
                        Some(sid),
                        false,
                        &state.backup_root,
                        &user_games,
                    ));
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn add_game(
    state: tauri::State<'_, AppState>,
    game_id: Option<String>,
    name: String,
    save_path: String,
) -> Result<GameInfo, String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    let mut gid: String;
    let gname: String;
    let gpath: String;
    let steam_app_id: Option<u32>;
    let is_custom: bool;

    if let Some(ref gid_ref) = game_id {
        // O(1) lookup from index
        let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
            .map_err(|e| e.to_string())?;
        let entry = crate::core::db::lookup_game(&index, gid_ref)
            .ok_or_else(|| format!("Game not found: {}", gid_ref))?;
        gid = gid_ref.clone();
        gname = entry.name.clone();
        gpath = entry.save_path.clone();
        steam_app_id = entry.steam_app_id;
        is_custom = false;
    } else {
        // Custom game — generate a unique ID (len-based IDs collide after removals)
        let mut cg = crate::core::db::load_custom_games(&state.custom_games_path)
            .map_err(|e| e.to_string())?;
        let mut next = cg.games.len();
        loop {
            gid = format!("custom-{}", next);
            if !cg.games.iter().any(|g| g.id == gid) {
                break;
            }
            next += 1;
        }
        gname = name;
        gpath = save_path;
        steam_app_id = None;
        is_custom = true;

        cg.games.push(crate::core::db::CustomGame {
            id: gid.clone(),
            name: gname.clone(),
            save_path: gpath.clone(),
        });
        crate::core::db::save_custom_games(&state.custom_games_path, &cg)
            .map_err(|e| e.to_string())?;
    }

    // Mark as monitored
    if !user_games.monitored.contains(&gid) {
        user_games.monitored.push(gid.clone());
        crate::core::db::save_user_games(&state.user_games_path, &user_games)
            .map_err(|e| e.to_string())?;
    }

    Ok(build_game_info(
        gid,
        gname,
        gpath,
        steam_app_id,
        is_custom,
        &state.backup_root,
        &user_games,
    ))
}

#[tauri::command]
pub fn remove_game(
    state: tauri::State<'_, AppState>,
    game_id: String,
    delete_backups: bool,
) -> Result<(), String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    // Find game name for backup deletion
    let game_name = {
        let games = get_games(state.clone())?;
        games
            .iter()
            .find(|g| g.id == game_id)
            .map(|g| g.name.clone())
    };

    // Remove from monitored + pinned
    user_games.monitored.retain(|id| id != &game_id);
    user_games.pinned.retain(|id| id != &game_id);

    // If custom, also remove from custom_games.json
    if game_id.starts_with("custom-") {
        let mut cg = crate::core::db::load_custom_games(&state.custom_games_path)
            .map_err(|e| e.to_string())?;
        cg.games.retain(|g| g.id != game_id);
        crate::core::db::save_custom_games(&state.custom_games_path, &cg)
            .map_err(|e| e.to_string())?;
    }

    crate::core::db::save_user_games(&state.user_games_path, &user_games)
        .map_err(|e| e.to_string())?;

    // Delete backup files if requested
    if delete_backups {
        if let Some(name) = game_name {
            let backup_dir = state.backup_root.join(&name);
            if backup_dir.exists() {
                std::fs::remove_dir_all(&backup_dir)
                    .map_err(|e| format!("Failed to delete backups: {}", e))?;
            }
        }
    }

    Ok(())
}

/// Return ONLY games the user has actively added / is monitoring.
#[tauri::command]
pub fn get_games(state: tauri::State<'_, AppState>) -> Result<Vec<GameInfo>, String> {
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    let custom =
        crate::core::db::load_custom_games(&state.custom_games_path).map_err(|e| e.to_string())?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    // DB games that are monitored — iterate only monitored IDs, lookup in index O(1) each
    for gid in &user_games.monitored {
        if let Some(entry) = crate::core::db::lookup_game(&index, gid) {
            results.push(build_game_info(
                gid.clone(),
                entry.name.clone(),
                entry.save_path.clone(),
                entry.steam_app_id,
                false,
                &state.backup_root,
                &user_games,
            ));
        }
    }

    // Custom games that are monitored
    for cg in &custom.games {
        if !user_games.is_monitored(&cg.id) {
            continue;
        }
        results.push(build_game_info(
            cg.id.clone(),
            cg.name.clone(),
            cg.save_path.clone(),
            None,
            true,
            &state.backup_root,
            &user_games,
        ));
    }

    // Sort: pinned first, then by snapshot_count descending
    results.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then_with(|| b.last_backup.cmp(&a.last_backup))
    });

    Ok(results)
}

/// Get a single game by ID (lighter than get_games — only builds one GameInfo).
#[tauri::command]
pub fn get_game_by_id(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<GameInfo, String> {
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    // Check custom games first — only if ID starts with "custom-"
    if game_id.starts_with("custom-") {
        let custom = crate::core::db::load_custom_games(&state.custom_games_path)
            .map_err(|e| e.to_string())?;
        for cg in &custom.games {
            if cg.id == game_id {
                return Ok(build_game_info_light(
                    cg.id.clone(),
                    cg.name.clone(),
                    cg.save_path.clone(),
                    None,
                    true,
                    &user_games,
                ));
            }
        }
    }

    // O(1) lookup from index (light build — no snapshot scan, no disk IO beyond index)
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    if let Some(entry) = crate::core::db::lookup_game(&index, &game_id) {
        return Ok(build_game_info_light(
            game_id.clone(),
            entry.name.clone(),
            entry.save_path.clone(),
            entry.steam_app_id,
            false,
            &user_games,
        ));
    }

    Err(format!("Game not found: {}", game_id))
}

/// Combined profile data for one IPC call (avoids 4 round-trips).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameProfileData {
    pub game: GameInfo,
    pub playtime_seconds: u64,
    pub is_favorite: bool,
    pub launch_config: Option<LaunchConfigDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfigDto {
    pub game_id: String,
    pub exe_path: String,
    pub args: Option<String>,
    pub launch_method: String,
}

/// Get all profile data in one call (game info + playtime + favorite + launch config).
#[tauri::command]
pub fn get_game_profile(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<GameProfileData, String> {
    let game = get_game_by_id(state.clone(), game_id.clone())?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    let playtime_seconds = user_games.get_playtime(&game_id);
    let is_favorite = user_games.is_favorite(&game_id);
    let launch_config = user_games
        .get_launch_config(&game_id)
        .map(|lc| LaunchConfigDto {
            game_id: lc.game_id.clone(),
            exe_path: lc.exe_path.clone(),
            args: lc.args.clone(),
            launch_method: lc.launch_method.clone(),
        });
    Ok(GameProfileData {
        game,
        playtime_seconds,
        is_favorite,
        launch_config,
    })
}

/// Return database games that are NOT yet monitored.
#[tauri::command]
pub fn get_available_games(
    state: tauri::State<'_, AppState>,
    show_all: bool,
) -> Result<Vec<GameInfo>, String> {
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for (id, entry) in &index.entries {
        if user_games.is_monitored(id) {
            continue;
        }
        if !show_all && !entry.popular {
            continue;
        }
        results.push(build_game_info(
            id.clone(),
            entry.name.clone(),
            entry.save_path.clone(),
            entry.steam_app_id,
            false,
            &state.backup_root,
            &user_games,
        ));
    }

    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

#[tauri::command]
pub fn pin_game(state: tauri::State<'_, AppState>, game_id: String) -> Result<(), String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    if !user_games.pinned.contains(&game_id) {
        user_games.pinned.push(game_id);
    }
    crate::core::db::save_user_games(&state.user_games_path, &user_games).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unpin_game(state: tauri::State<'_, AppState>, game_id: String) -> Result<(), String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    user_games.pinned.retain(|id| id != &game_id);
    crate::core::db::save_user_games(&state.user_games_path, &user_games).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_game_path(
    state: tauri::State<'_, AppState>,
    game_id: String,
    save_path: String,
) -> Result<(), String> {
    if game_id.starts_with("custom-") {
        // Update custom game entry
        let mut cg = crate::core::db::load_custom_games(&state.custom_games_path)
            .map_err(|e| e.to_string())?;
        if let Some(game) = cg.games.iter_mut().find(|g| g.id == game_id) {
            game.save_path = save_path;
        }
        crate::core::db::save_custom_games(&state.custom_games_path, &cg)
            .map_err(|e| e.to_string())?;
    } else {
        // For DB games, save path override in user_games.json
        let mut user_games =
            crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
        // Store override: remove old entry for this id if exists, add new one
        user_games.path_overrides.retain(|(id, _)| id != &game_id);
        user_games.path_overrides.push((game_id.clone(), save_path));
        crate::core::db::save_user_games(&state.user_games_path, &user_games)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_game_auto_backup(
    state: tauri::State<'_, AppState>,
    game_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut ug =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    ug.auto_backup.retain(|id| id != &game_id);
    if enabled {
        ug.auto_backup.push(game_id);
    }
    crate::core::db::save_user_games(&state.user_games_path, &ug).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    let target = if p.is_dir() {
        p
    } else if p.is_file() {
        p.parent().unwrap_or(&p).to_path_buf()
    } else {
        return Err("Path does not exist".into());
    };
    std::process::Command::new("explorer")
        .arg(target.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Find Steam game install directory by app ID.
#[tauri::command]
pub fn find_steam_exe_path(app_id: u32) -> Result<String, String> {
    let install_dirs = crate::core::scanner::detect_steam_game_install_dirs();
    if let Some(path) = install_dirs.get(&app_id) {
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    let steam_path = crate::core::scanner::detect_steam_installation()
        .ok_or_else(|| "Steam not found".to_string())?;
    let lib_folders = crate::core::scanner::parse_library_folders(&steam_path);
    for lib in &lib_folders {
        let manifest = lib
            .join("steamapps")
            .join(format!("appmanifest_{}.acf", app_id));
        if let Ok(content) = std::fs::read_to_string(&manifest) {
            for line in content.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("\"installdir\"") {
                    let dir_name = rest.trim().trim_matches('"');
                    let install_dir = lib.join("steamapps").join("common").join(dir_name);
                    if install_dir.exists() {
                        return Ok(install_dir.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    Err("Install directory not found for this Steam app".to_string())
}

// ─────── Favorites & Tags ───────

#[tauri::command]
pub fn toggle_favorite(state: tauri::State<'_, AppState>, game_id: String) -> Result<bool, String> {
    let mut ug =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    let result = ug.toggle_favorite(&game_id);
    crate::core::db::save_user_games(&state.user_games_path, &ug).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub fn get_favorites(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let ug = crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    Ok(ug.favorites.clone())
}

#[tauri::command]
pub fn set_game_tags(
    state: tauri::State<'_, AppState>,
    game_id: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let mut ug =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    ug.set_tags(&game_id, tags);
    crate::core::db::save_user_games(&state.user_games_path, &ug).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_tags(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let ug = crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    Ok(ug.all_tags())
}

#[tauri::command]
pub fn get_game_tags(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<Vec<String>, String> {
    let ug = crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    Ok(ug.get_tags(&game_id))
}
