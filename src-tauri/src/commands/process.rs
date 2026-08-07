use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfigDto {
    pub game_id: String,
    pub exe_path: String,
    pub args: Option<String>,
    pub launch_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaytimeInfo {
    pub game_id: String,
    pub total_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningGameInfo {
    pub game_id: String,
    pub start_time: String,
    pub pid: u32,
}

/// Launch a game by game_id. Resolves exe from LaunchConfig or steamlocate.
#[tauri::command]
pub fn launch_game(state: tauri::State<'_, AppState>, game_id: String) -> Result<String, String> {
    let games = crate::commands::games::get_games(state.clone())
        .map_err(|e| format!("Failed to get games: {}", e))?;
    let game = games
        .iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| format!("Game not found: {}", game_id))?;

    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    // Try LaunchConfig first
    let exe_path = if let Some(lc) = user_games.get_launch_config(&game_id) {
        if lc.launch_method == "steam_protocol" {
            // Steam protocol launch — no PID tracking
            let steam_url = format!("steam://rungameid/{}", game.steam_app_id.unwrap_or(0));
            std::process::Command::new("cmd")
                .args(["/C", "start", &steam_url])
                .spawn()
                .map_err(|e| format!("Failed to launch via Steam: {}", e))?;
            return Ok(format!("steam://{}", game.steam_app_id.unwrap_or(0)));
        }
        Some(std::path::PathBuf::from(&lc.exe_path))
    } else if let Some(steam_id) = game.steam_app_id {
        // Try steamlocate
        crate::core::scanner::find_steam_game_exe(steam_id)
    } else {
        None
    };

    let exe_path = exe_path.ok_or_else(|| {
        "No executable configured. Right-click to set launch program.".to_string()
    })?;

    let args = user_games
        .get_launch_config(&game_id)
        .and_then(|lc| lc.args.as_deref());

    let pid = state
        .process_manager
        .launch(&game_id, &game.name, &exe_path, args)?;
    Ok(format!("PID: {}", pid))
}

/// Stop a running game process.
#[tauri::command]
pub fn stop_game(state: tauri::State<'_, AppState>, game_id: String) -> Result<(), String> {
    state.process_manager.stop(&game_id)
}

/// Get list of currently running game IDs.
#[tauri::command]
pub fn get_running_games(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RunningGameInfo>, String> {
    let games = state.process_manager.running_games();
    let mut result = Vec::new();
    for gid in games {
        if let (Some(start_time), Some(pid)) = (
            state.process_manager.get_start_time(&gid),
            state.process_manager.get_pid(&gid),
        ) {
            result.push(RunningGameInfo {
                game_id: gid,
                start_time,
                pid,
            });
        }
    }
    Ok(result)
}

/// Get total playtime for a game.
#[tauri::command]
pub fn get_playtime(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<PlaytimeInfo, String> {
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    let seconds = user_games.get_playtime(&game_id);
    Ok(PlaytimeInfo {
        game_id,
        total_seconds: seconds,
    })
}

/// Set launch configuration for a game.
#[tauri::command]
pub fn set_launch_config(
    state: tauri::State<'_, AppState>,
    game_id: String,
    exe_path: String,
    args: Option<String>,
) -> Result<(), String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    user_games.set_launch_config(crate::core::db::LaunchConfig {
        game_id,
        exe_path,
        args,
        launch_method: "direct".into(),
    });
    crate::core::db::save_user_games(&state.user_games_path, &user_games).map_err(|e| e.to_string())
}

/// Get launch configuration for a game.
#[tauri::command]
pub fn get_launch_config(
    state: tauri::State<'_, AppState>,
    game_id: String,
) -> Result<Option<LaunchConfigDto>, String> {
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    Ok(user_games
        .get_launch_config(&game_id)
        .map(|lc| LaunchConfigDto {
            game_id: lc.game_id.clone(),
            exe_path: lc.exe_path.clone(),
            args: lc.args.clone(),
            launch_method: lc.launch_method.clone(),
        }))
}

/// Set process check interval.
#[tauri::command]
pub fn set_process_check_interval(
    state: tauri::State<'_, AppState>,
    seconds: u64,
) -> Result<(), String> {
    state.process_manager.set_check_interval(seconds);
    Ok(())
}

// ─────── Steam playtime sync ───────

/// Sync playtime from Steam localconfig.vdf.
#[tauri::command]
pub fn sync_steam_playtime(state: tauri::State<'_, AppState>) -> Result<Vec<PlaytimeInfo>, String> {
    let steam_data = crate::core::steam_sync::parse_steam_playtime()?;
    if steam_data.is_empty() {
        return Ok(vec![]);
    }

    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    let mut updated = Vec::new();

    for (game_id, entry) in &index.entries {
        if let Some(steam_id) = entry.steam_app_id {
            if let Some(&seconds) = steam_data.get(&steam_id) {
                if let Some(existing) = user_games
                    .total_playtime
                    .iter_mut()
                    .find(|(id, _)| id == game_id)
                {
                    existing.1 = seconds;
                } else {
                    user_games.total_playtime.push((game_id.clone(), seconds));
                }
                updated.push(PlaytimeInfo {
                    game_id: game_id.clone(),
                    total_seconds: seconds,
                });
            }
        }
    }

    crate::core::db::save_user_games(&state.user_games_path, &user_games)
        .map_err(|e| e.to_string())?;
    Ok(updated)
}

// ─────── Playtime statistics ───────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayPlaytime {
    pub date: String,
    pub seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePlaytime {
    pub game_id: String,
    pub game_name: String,
    pub seconds: u64,
    pub sessions: usize,
    pub last_played: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaytimeStats {
    pub total_seconds: u64,
    pub weekly_seconds: u64,
    pub monthly_seconds: u64,
    pub daily_average: u64,
    pub daily_breakdown: Vec<DayPlaytime>,
    pub per_game: Vec<GamePlaytime>,
}

#[tauri::command]
pub fn get_playtime_stats(state: tauri::State<'_, AppState>) -> Result<PlaytimeStats, String> {
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    let index = crate::core::db::load_game_index(&state.db_path, &state.games_index_path)
        .map_err(|e| e.to_string())?;

    let now = chrono::Local::now().naive_local();
    let week_ago = now - chrono::Duration::days(7);
    let month_ago = now - chrono::Duration::days(30);

    let total_seconds: u64 = user_games.total_playtime.iter().map(|(_, s)| *s).sum();

    // Daily breakdown (last 30 days)
    let mut daily_map: HashMap<String, u64> = HashMap::new();
    let mut weekly_seconds = 0u64;
    let mut monthly_seconds = 0u64;

    for session in &user_games.play_sessions {
        if let (Some(dur), Some(end_str)) = (session.duration_seconds, &session.end_time) {
            let date = end_str.chars().take(10).collect::<String>();
            *daily_map.entry(date.clone()).or_insert(0) += dur;

            // Parse as naive datetime (stored in local time)
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(end_str, "%Y-%m-%dT%H:%M:%S") {
                if dt >= week_ago {
                    weekly_seconds += dur;
                }
                if dt >= month_ago {
                    monthly_seconds += dur;
                }
            }
        }
    }

    let mut daily_breakdown: Vec<DayPlaytime> = daily_map
        .into_iter()
        .map(|(date, seconds)| DayPlaytime { date, seconds })
        .collect();
    daily_breakdown.sort_by(|a, b| a.date.cmp(&b.date));

    let days_with_data = daily_breakdown.len().max(1) as u64;
    let daily_average = monthly_seconds / days_with_data.min(30);

    // Per-game stats
    let mut per_game: Vec<GamePlaytime> = user_games
        .total_playtime
        .iter()
        .map(|(gid, secs)| {
            let name = crate::core::db::lookup_game(&index, gid)
                .map(|e| e.name.clone())
                .unwrap_or_else(|| gid.clone());
            let mut sessions = 0usize;
            let mut last_played = None;
            for s in &user_games.play_sessions {
                if s.game_id == *gid {
                    sessions += 1;
                    if let Some(t) = &s.end_time {
                        if last_played.as_ref().map_or(true, |lp: &String| t > lp) {
                            last_played = Some(t.clone());
                        }
                    }
                }
            }
            GamePlaytime {
                game_id: gid.clone(),
                game_name: name,
                seconds: *secs,
                sessions,
                last_played,
            }
        })
        .collect();

    per_game.sort_by(|a, b| b.seconds.cmp(&a.seconds));

    Ok(PlaytimeStats {
        total_seconds,
        weekly_seconds,
        monthly_seconds,
        daily_average,
        daily_breakdown,
        per_game,
    })
}
