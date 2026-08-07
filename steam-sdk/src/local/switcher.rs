//! Steam account switching.
//!
//! Implements Steam account switching by manipulating:
//! - Windows registry (`AutoLoginUser`, `RememberPassword`)
//! - `loginusers.vdf` (MostRecent, AllowAutoLogin flags)
//! - `config.vdf` (AlwaysShowUserChooser)
//! - Steam process (kill + restart)

use super::steam_path::detect_steam;
use crate::error::{Result, SteamError};
use crate::vdf::{parse_vdf, write_vdf, VdfValue};
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

// ── Data types ──────────────────────────────────────────────

/// Represents a Steam user found in loginusers.vdf.
#[derive(Debug, Clone)]
pub struct SteamUser {
    /// SteamID64.
    pub steam_id64: u64,
    /// Account name used for login.
    pub account_name: String,
    /// Display persona name.
    pub persona_name: String,
    /// Whether password is remembered.
    pub remember_password: bool,
    /// Whether this is the most recently used account.
    pub most_recent: bool,
    /// Whether AutoLogin is enabled.
    pub auto_login: bool,
    /// WantsOfflineMode flag.
    pub wants_offline_mode: bool,
    /// SkipOfflineModeWarning flag.
    pub skip_offline_mode_warning: bool,
    /// Timestamp of last login.
    pub timestamp: u64,
    /// Avatar hash from localconfig.vdf (for CDN URL).
    pub avatar_hash: Option<String>,
}

// ── Account listing ─────────────────────────────────────────

/// Read all Steam users from `loginusers.vdf`.
///
/// Returns a list of [`SteamUser`] sorted by most recent first.
/// If Steam is not installed, returns an empty list (no error).
pub fn read_login_users() -> Result<Vec<SteamUser>> {
    let install = match detect_steam() {
        Ok(i) => i,
        Err(_) => return Ok(Vec::new()), // Steam not installed — empty list
    };
    let loginusers_path = install.loginusers_vdf();

    if !loginusers_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&loginusers_path).map_err(|e| SteamError::Io(e))?;
    let root = parse_vdf(&content)?;

    let users_map = root.get("users").ok_or_else(|| {
        SteamError::Vdf(crate::error::VdfError::Parse {
            line: 0,
            message: "No 'users' key in loginusers.vdf".into(),
        })
    })?;

    let entries = users_map.as_map().ok_or_else(|| {
        SteamError::Vdf(crate::error::VdfError::Parse {
            line: 0,
            message: "'users' is not a map".into(),
        })
    })?;

    let install = match detect_steam() {
        Ok(i) => Some(i),
        Err(_) => None,
    };

    let mut users: Vec<SteamUser> = entries
        .iter()
        .map(|(steam_id64_str, user_data)| {
            let steam_id64: u64 = steam_id64_str.parse().unwrap_or(0);
            let steam_id32 = (steam_id64 & 0xFFFF_FFFF) as u32;

            // Read avatar hash from localconfig.vdf: system.avatar
            let avatar_hash = install
                .as_ref()
                .and_then(|inst| read_avatar_hash(inst, steam_id32));

            SteamUser {
                steam_id64,
                account_name: string_val(user_data, "AccountName").unwrap_or_default(),
                persona_name: string_val(user_data, "PersonaName").unwrap_or_default(),
                remember_password: bool_val(user_data, "RememberPassword").unwrap_or(false),
                most_recent: bool_val(user_data, "MostRecent").unwrap_or(false),
                auto_login: bool_val(user_data, "AutoLogin").unwrap_or(false),
                wants_offline_mode: bool_val(user_data, "WantsOfflineMode").unwrap_or(false),
                skip_offline_mode_warning: bool_val(user_data, "SkipOfflineModeWarning")
                    .unwrap_or(false),
                timestamp: u64_val(user_data, "Timestamp").unwrap_or(0),
                avatar_hash,
            }
        })
        .collect();

    // Sort: most recent first
    users.sort_by(|a, b| {
        b.most_recent
            .cmp(&a.most_recent)
            .then(b.timestamp.cmp(&a.timestamp))
    });

    Ok(users)
}

/// Get the currently active Steam user.
pub fn current_user() -> Result<Option<SteamUser>> {
    let users = read_login_users()?;
    if users.is_empty() {
        return Ok(None);
    }

    if let Some(auto_login_user) = read_auto_login_user().ok().flatten() {
        if let Some(user) = users
            .iter()
            .find(|u| u.account_name.eq_ignore_ascii_case(&auto_login_user))
        {
            return Ok(Some(user.clone()));
        }
    }

    Ok(users.into_iter().find(|u| u.most_recent))
}

// ── Account switching ───────────────────────────────────────

/// Switch to a Steam account identified by SteamID64.
///
/// The full flow:
/// 1. Kill all Steam processes
/// 2. Write `AutoLoginUser` to Windows registry (or registry.vdf on Linux/macOS)
/// 3. Update `loginusers.vdf`: target user gets MostRecent=1, others 0
/// 4. Update `config.vdf`: AlwaysShowUserChooser=0
/// 5. Start Steam (which will auto-login to the target account)
pub fn switch_account(steam_id64: u64) -> Result<()> {
    switch_account_with_options(steam_id64, false, None)
}

pub fn switch_account_with_options(
    steam_id64: u64,
    offline_mode: bool,
    persona_state: Option<u32>,
) -> Result<()> {
    let install = detect_steam()?;

    // Step 1: Kill Steam
    kill_steam_process();

    // Step 2: Set AutoLoginUser in registry
    let users = read_login_users()?;
    let target = users
        .iter()
        .find(|u| u.steam_id64 == steam_id64)
        .ok_or_else(|| {
            SteamError::NotFound(format!(
                "Steam user {} not found in loginusers.vdf",
                steam_id64
            ))
        })?;

    set_auto_login_user(&target.account_name)?;

    // Step 3: Update loginusers.vdf
    update_login_users_flags(&install, steam_id64, offline_mode, offline_mode)?;

    // Step 4: Persist persona state when requested.
    // This should not block account switching if localconfig.vdf is unavailable.
    if let Some(state) = persona_state {
        let _ = set_persona_state((steam_id64 & 0xFFFF_FFFF) as u32, state);
    }

    // Step 5: Update config.vdf
    update_always_show_user_chooser(&install, false)?;

    // Step 6: Start Steam
    start_steam_process(&install);

    Ok(())
}

/// Clear the current login user (logout).
pub fn clear_current_user() -> Result<()> {
    kill_steam_process();
    set_auto_login_user("")?;
    Ok(())
}

// ── Registry operations ─────────────────────────────────────

/// Read the Steam `AutoLoginUser` value and use it as the preferred current account source.
#[cfg(target_os = "windows")]
fn read_auto_login_user() -> Result<Option<String>> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu
        .open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ)
        .map_err(|_| SteamError::NotFound("Steam registry key not found".into()))?;

    let account_name: String = steam_key
        .get_value("AutoLoginUser")
        .map_err(|_| SteamError::NotFound("AutoLoginUser registry value not found".into()))?;

    let trimmed = account_name.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    Ok(Some(trimmed.to_string()))
}

#[cfg(not(target_os = "windows"))]
fn read_auto_login_user() -> Result<Option<String>> {
    let install = detect_steam()?;
    let registry_path = install.path.join("registry.vdf");
    if !registry_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&registry_path).map_err(SteamError::Io)?;
    let root = parse_vdf(&content)?;
    let account_name = root
        .navigate(&["HKCU", "Software", "Valve", "Steam", "AutoLoginUser"])
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);

    Ok(account_name)
}

/// Write the Steam `AutoLoginUser` registry value.
#[cfg(target_os = "windows")]
fn set_auto_login_user(account_name: &str) -> Result<()> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu
        .open_subkey_with_flags(r"Software\Valve\Steam", KEY_WRITE)
        .map_err(|_| SteamError::NotFound("Steam registry key not found".into()))?;

    steam_key
        .set_value("AutoLoginUser", &account_name)
        .map_err(|e| SteamError::General(format!("Failed to set AutoLoginUser: {}", e)))?;

    steam_key
        .set_value("RememberPassword", &1u32)
        .map_err(|e| SteamError::General(format!("Failed to set RememberPassword: {}", e)))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_auto_login_user(account_name: &str) -> Result<()> {
    // On Linux/macOS, modify registry.vdf instead
    let install = detect_steam()?;
    let registry_path = install.path.join("registry.vdf");

    if registry_path.exists() {
        let content = fs::read_to_string(&registry_path).map_err(SteamError::Io)?;
        let mut root = parse_vdf(&content)?;

        root.navigate_mut(&["HKCU", "Software", "Valve", "Steam", "AutoLoginUser"])
            .map(|v| *v = VdfValue::String(account_name.to_string()));

        write_vdf(&registry_path, &root)?;
    }

    Ok(())
}

// ── VDF file updates ────────────────────────────────────────

/// Update `loginusers.vdf` to set MostRecent flag for the target user.
fn update_login_users_flags(
    install: &super::steam_path::SteamInstallation,
    target_steam_id64: u64,
    wants_offline_mode: bool,
    skip_offline_mode_warning: bool,
) -> Result<()> {
    let loginusers_path = install.loginusers_vdf();
    if !loginusers_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&loginusers_path).map_err(SteamError::Io)?;
    let mut root = parse_vdf(&content)?;

    let target_id_str = target_steam_id64.to_string();

    if let Some(users_map) = root.get_mut("users") {
        if let Some(entries) = users_map.as_map().map(|e| e.clone()) {
            for (uid, _user_data) in &entries {
                if let Some(user_data) = users_map.get_mut(uid) {
                    if uid == &target_id_str {
                        user_data.set("MostRecent", VdfValue::String("1".into()));
                        user_data.set("AllowAutoLogin", VdfValue::String("1".into()));
                        user_data.set(
                            "WantsOfflineMode",
                            VdfValue::String(if wants_offline_mode { "1" } else { "0" }.into()),
                        );
                        user_data.set(
                            "SkipOfflineModeWarning",
                            VdfValue::String(
                                if skip_offline_mode_warning { "1" } else { "0" }.into(),
                            ),
                        );
                    } else {
                        user_data.set("MostRecent", VdfValue::String("0".into()));
                    }
                }
            }
        }
    }

    write_vdf(&loginusers_path, &root)?;
    Ok(())
}

/// Update `config.vdf` to set `AlwaysShowUserChooser`.
fn update_always_show_user_chooser(
    install: &super::steam_path::SteamInstallation,
    show: bool,
) -> Result<()> {
    let config_path = install.config_vdf();
    if !config_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&config_path).map_err(SteamError::Io)?;
    let mut root = parse_vdf(&content)?;

    let val = if show { "1" } else { "0" };
    root.ensure_path(
        &[
            "InstallConfigStore",
            "Software",
            "Valve",
            "Steam",
            "AlwaysShowUserChooser",
        ],
        VdfValue::String(val.to_string()),
    );

    write_vdf(&config_path, &root)?;
    Ok(())
}

// ── Persona state ───────────────────────────────────────────
// Translated from: SetPersonaState(string steamId32, PersonaState ePersonaState)

/// Set the ePersonaState value in a user's localconfig.vdf.
///
/// Values: 0=Offline, 1=Online, 2=Busy, 3=Away, 4=Snooze,
/// 5=Looking to Trade, 6=Looking to Play, 7=Invisible
pub fn set_persona_state(steam_id32: u32, state: u32) -> Result<()> {
    let install = detect_steam()?;
    let localconfig = install.localconfig_vdf(steam_id32);
    if !localconfig.exists() {
        return Err(SteamError::NotFound("localconfig.vdf not found".into()));
    }
    if state > 7 {
        return Err(SteamError::General("PersonaState must be 0-7".into()));
    }

    let content = fs::read_to_string(&localconfig).map_err(SteamError::Io)?;

    // Find "ePersonaState" key and replace its value inline
    // SteamTools does this with IndexOf + StringBuilder manipulation
    let search = "\"ePersonaState\"";
    let pos = content.find(search).ok_or_else(|| {
        SteamError::NotFound("ePersonaState key not found in localconfig.vdf".into())
    })?;

    // Find the value part: after the key, there's a tab and quoted value
    let after_key = &content[pos + search.len()..];
    let value_start = after_key.find('"').ok_or_else(|| {
        SteamError::Vdf(crate::error::VdfError::Parse {
            line: 0,
            message: "Could not find value after ePersonaState".into(),
        })
    })?;
    let after_value_start = &after_key[value_start + 1..];
    let value_end = after_value_start.find('"').ok_or_else(|| {
        SteamError::Vdf(crate::error::VdfError::Parse {
            line: 0,
            message: "Could not find closing quote for ePersonaState value".into(),
        })
    })?;

    let absolute_value_start = pos + search.len() + value_start + 1;
    let absolute_value_end = pos + search.len() + value_start + 1 + value_end;

    let mut new_content = String::with_capacity(content.len());
    new_content.push_str(&content[..absolute_value_start]);
    new_content.push_str(&state.to_string());
    new_content.push_str(&content[absolute_value_end..]);

    fs::write(&localconfig, new_content).map_err(SteamError::Io)
}

// ── Process management ──────────────────────────────────────

/// Kill all running Steam processes.
fn kill_steam_process() {
    let steam_procs = [
        "steam.exe",
        "steamservice.exe",
        "steamwebhelper.exe",
        "GameOverlayUI.exe",
    ];

    for name in &steam_procs {
        if let Ok(output) = Command::new("taskkill")
            .args(["/F", "/IM", name])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output()
        {
            log::debug!("taskkill /IM {}: {:?}", name, output.status);
        }
    }

    // Give processes time to exit
    std::thread::sleep(std::time::Duration::from_millis(500));
}

/// Start the Steam process.
fn start_steam_process(install: &super::steam_path::SteamInstallation) {
    let _ = Command::new(&install.exe)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            log::error!("Failed to start Steam: {}", e);
        });
}

// ── Helper functions ────────────────────────────────────────

/// Extract a string value from a VDF map.
fn string_val(map: &VdfValue, key: &str) -> Option<String> {
    map.get(key)?.as_str().map(|s| s.to_string())
}

/// Extract a boolean value from a VDF map (stored as "0" or "1").
fn bool_val(map: &VdfValue, key: &str) -> Option<bool> {
    match map.get(key)?.as_str()? {
        "1" => Some(true),
        "0" => Some(false),
        _ => None,
    }
}

/// Extract a u64 value from a VDF map.
fn u64_val(map: &VdfValue, key: &str) -> Option<u64> {
    map.get(key)?.as_str()?.parse().ok()
}

/// Read the avatar hash from a user's localconfig.vdf.
/// Path: userdata/{steamId32}/config/localconfig.vdf → friends/{steamId3}/avatar
fn read_avatar_hash(
    install: &crate::local::steam_path::SteamInstallation,
    steam_id32: u32,
) -> Option<String> {
    let localconfig = install.localconfig_vdf(steam_id32);
    if !localconfig.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&localconfig).ok()?;
    let root = parse_vdf(&content).ok()?;
    // Avatar is at: UserLocalConfigStore → friends → {steamId3} → avatar
    let steam_id3_str = steam_id32.to_string();
    let avatar = root.navigate(&["UserLocalConfigStore", "friends", &steam_id3_str, "avatar"]);
    avatar.and_then(|v| v.as_str().map(|s| s.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_read_login_users_from_real_file() {
        // This test verifies we can parse a real loginusers.vdf if present
        let users = read_login_users();
        if let Ok(users) = users {
            // If Steam is installed, we should have at least the user
            // who is currently logged in. If Steam isn't installed,
            // this returns Ok([]) or Err.
            if !users.is_empty() {
                let first = &users[0];
                assert!(!first.account_name.is_empty());
                assert!(first.steam_id64 > 0);
            }
        }
    }

    #[test]
    fn test_parse_users_from_vdf_string() {
        let input = r#"
"users"
{
    "76561199091385455"
    {
        "AccountName"       "testuser"
        "PersonaName"       "TestUser"
        "RememberPassword"      "1"
        "MostRecent"        "1"
        "Timestamp"     "1784856107"
    }
}
"#;
        let root = parse_vdf(input).unwrap();
        let users_map = root.get("users").unwrap();
        let entries = users_map.as_map().unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "76561199091385455");

        assert_eq!(
            string_val(&entries[0].1, "AccountName").unwrap(),
            "testuser"
        );
        assert!(bool_val(&entries[0].1, "MostRecent").unwrap());
    }
}
