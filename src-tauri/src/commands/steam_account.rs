//! Tauri commands for Steam account switching.
//!
//! Bridges the `steam-sdk::local` module to the frontend.

use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

/// DTO for a Steam user account.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAccountDto {
    pub steam_id64: String,
    pub account_name: String,
    pub persona_name: String,
    pub remember_password: bool,
    pub most_recent: bool,
    pub avatar_hash: Option<String>,
    pub remark: Option<String>,
}

fn parse_steam_id64(steam_id64: String) -> Result<u64, String> {
    steam_id64
        .parse::<u64>()
        .map_err(|_| format!("Invalid SteamID64: {}", steam_id64))
}

fn build_account_dto(
    user: steam_sdk::local::switcher::SteamUser,
    user_games: &crate::core::db::UserGames,
) -> SteamAccountDto {
    let steam_id64 = user.steam_id64.to_string();
    SteamAccountDto {
        remark: user_games.get_steam_account_remark(&steam_id64),
        steam_id64,
        account_name: user.account_name,
        persona_name: user.persona_name,
        remember_password: user.remember_password,
        most_recent: user.most_recent,
        avatar_hash: user.avatar_hash,
    }
}

/// List all Steam accounts found on this machine.
#[tauri::command]
pub fn get_steam_accounts(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SteamAccountDto>, String> {
    let users = steam_sdk::local::switcher::read_login_users().map_err(|e| e.to_string())?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;

    Ok(users
        .into_iter()
        .map(|user| build_account_dto(user, &user_games))
        .collect())
}

/// Switch to the specified Steam account.
///
/// This kills Steam, updates the registry/VDF files, and restarts Steam.
#[tauri::command]
pub fn switch_steam_account(steam_id64: String) -> Result<(), String> {
    let parsed_id = parse_steam_id64(steam_id64)?;

    steam_sdk::local::switcher::switch_account(parsed_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn switch_steam_account_with_options(
    steam_id64: String,
    offline_mode: bool,
    persona_state: Option<u32>,
) -> Result<(), String> {
    let parsed_id = parse_steam_id64(steam_id64)?;

    steam_sdk::local::switcher::switch_account_with_options(parsed_id, offline_mode, persona_state)
        .map_err(|e| e.to_string())
}

/// Get the currently active Steam user, if any.
#[tauri::command]
pub fn get_current_steam_user(
    state: tauri::State<'_, AppState>,
) -> Result<Option<SteamAccountDto>, String> {
    let user = steam_sdk::local::switcher::current_user().map_err(|e| e.to_string())?;
    let user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    Ok(user.map(|u| build_account_dto(u, &user_games)))
}

#[tauri::command]
pub fn set_steam_account_remark(
    state: tauri::State<'_, AppState>,
    steam_id64: String,
    remark: String,
) -> Result<Option<String>, String> {
    let mut user_games =
        crate::core::db::load_user_games(&state.user_games_path).map_err(|e| e.to_string())?;
    user_games.set_steam_account_remark(&steam_id64, remark);
    let next_remark = user_games.get_steam_account_remark(&steam_id64);
    crate::core::db::save_user_games(&state.user_games_path, &user_games)
        .map_err(|e| e.to_string())?;
    Ok(next_remark)
}

#[tauri::command]
pub fn get_steam_account_userdata_path(steam_id64: String) -> Result<String, String> {
    let parsed_id = parse_steam_id64(steam_id64)?;
    let path =
        steam_sdk::local::account_tools::userdata_path(parsed_id).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_steam_account_userdata_folder(steam_id64: String) -> Result<(), String> {
    let parsed_id = parse_steam_id64(steam_id64)?;
    let path =
        steam_sdk::local::account_tools::userdata_path(parsed_id).map_err(|e| e.to_string())?;

    if !path.is_dir() {
        return Err(format!(
            "Steam userdata folder does not exist: {}",
            path.to_string_lossy()
        ));
    }

    let windows_dir = std::env::var("WINDIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"C:\Windows"));
    let explorer = windows_dir.join("explorer.exe");
    let quoted_path = format!("\"{}\"", path.to_string_lossy());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        Command::new(explorer)
            .current_dir(windows_dir)
            .raw_arg(quoted_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("explorer")
            .arg(path.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_steam_account_data(steam_id64: String, delete_userdata: bool) -> Result<(), String> {
    let parsed_id = parse_steam_id64(steam_id64)?;
    steam_sdk::local::steam_service::delete_local_user_data(parsed_id, delete_userdata)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_steam_account_shortcut(
    steam_id64: String,
    display_name: String,
) -> Result<String, String> {
    let parsed_id = parse_steam_id64(steam_id64)?;
    let shortcut_path = create_shortcut_to_account_switch(parsed_id, &display_name)?;
    Ok(shortcut_path.to_string_lossy().to_string())
}

/// Diagnostic: check if Steam is detected and return info.
#[tauri::command]
pub fn check_steam_status() -> Result<serde_json::Value, String> {
    let install = steam_sdk::local::steam_path::detect_steam();
    match install {
        Ok(inst) => Ok(serde_json::json!({
            "found": true,
            "path": inst.path.to_string_lossy(),
            "exe": inst.exe.to_string_lossy(),
        })),
        Err(_) => Ok(serde_json::json!({
            "found": false,
            "message": "Steam installation not detected. Make sure Steam is installed."
        })),
    }
}

#[cfg(target_os = "windows")]
fn create_shortcut_to_account_switch(
    steam_id64: u64,
    display_name: &str,
) -> Result<PathBuf, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to locate app executable: {}", e))?;
    let exe_dir = exe_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "App executable directory not found".to_string())?;

    let user_profile =
        std::env::var("USERPROFILE").map_err(|_| "Desktop directory not found".to_string())?;
    let desktop_dir = PathBuf::from(user_profile).join("Desktop");
    std::fs::create_dir_all(&desktop_dir)
        .map_err(|e| format!("Failed to create desktop directory: {}", e))?;

    let shortcut_path = desktop_dir.join(format!("{}.lnk", sanitize_file_name(display_name)));
    let arguments = format!("--switch-steam-account {}", steam_id64);

    let script = format!(
        "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('{}'); $Shortcut.TargetPath = '{}'; $Shortcut.Arguments = '{}'; $Shortcut.WorkingDirectory = '{}'; $Shortcut.IconLocation = '{},0'; $Shortcut.Description = 'Switch Steam account with EasyGameHub'; $Shortcut.Save()",
        powershell_escape(shortcut_path.to_string_lossy().as_ref()),
        powershell_escape(exe_path.to_string_lossy().as_ref()),
        powershell_escape(&arguments),
        powershell_escape(exe_dir.to_string_lossy().as_ref()),
        powershell_escape(exe_path.to_string_lossy().as_ref()),
    );

    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .status()
        .map_err(|e| format!("Failed to create shortcut: {}", e))?;

    if !status.success() {
        return Err("PowerShell failed to create the desktop shortcut".into());
    }

    Ok(shortcut_path)
}

#[cfg(not(target_os = "windows"))]
fn create_shortcut_to_account_switch(
    _steam_id64: u64,
    _display_name: &str,
) -> Result<PathBuf, String> {
    Err("Desktop shortcut creation is only supported on Windows".into())
}

fn sanitize_file_name(name: &str) -> String {
    let filtered: String = name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect();
    let trimmed = filtered.trim();
    if trimmed.is_empty() {
        "Steam Account".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(target_os = "windows")]
fn powershell_escape(value: &str) -> String {
    value.replace('"', "`").replace('\'', "''")
}
