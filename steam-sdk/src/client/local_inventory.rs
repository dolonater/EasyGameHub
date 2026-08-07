//! Read Steam game library from local VDF files.
//!
//! Reads owned games from `localconfig.vdf` and installed games from
//! `appmanifest_*.acf` — no Web API key required. This is the same
//! approach SteamTools uses for its inventory display.

use crate::error::{Result, SteamError};
use crate::local::steam_path::detect_steam;
use crate::vdf::parse_vdf;
use std::collections::HashMap;
use std::fs;

/// A locally-detected Steam game.
#[derive(Debug, Clone)]
pub struct LocalGame {
    /// Steam App ID.
    pub app_id: u32,
    /// Game name (from installed appmanifest, if available).
    pub name: Option<String>,
    /// Total playtime in minutes.
    pub playtime_minutes: u64,
    /// Whether the game is currently installed.
    pub is_installed: bool,
    /// Install directory (if installed).
    pub install_dir: Option<String>,
    /// Size on disk in bytes (if installed).
    pub size_on_disk: Option<u64>,
}

/// Get owned games from local Steam files.
///
/// Reads `localconfig.vdf` in all userdata directories to get the full
/// list of owned app IDs with playtime, then cross-references with
/// installed games from `appmanifest_*.acf` files.
pub fn get_local_games() -> Result<Vec<LocalGame>> {
    let install = detect_steam()?;

    // 1. Read owned apps + playtime from localconfig.vdf
    let owned = read_owned_apps(&install.userdata)?;

    // 2. Read installed apps from appmanifest files
    let installed = read_installed_apps(&install)?;

    let mut games: Vec<LocalGame> = Vec::new();

    for (app_id, owned_info) in &owned {
        let inst_info = installed.get(app_id);
        games.push(LocalGame {
            app_id: *app_id,
            // ACF name (installed) > localconfig.vdf name (all owned)
            name: inst_info
                .and_then(|i| i.name.clone())
                .or_else(|| owned_info.name.clone()),
            playtime_minutes: owned_info.playtime_minutes,
            is_installed: inst_info.is_some(),
            install_dir: inst_info.and_then(|i| i.install_dir.clone()),
            size_on_disk: inst_info.and_then(|i| i.size_on_disk),
        });
    }

    // Also include installed games that aren't in owned list (rare but possible)
    for (app_id, inst_info) in &installed {
        if !owned.contains_key(app_id) {
            games.push(LocalGame {
                app_id: *app_id,
                name: inst_info.name.clone(),
                playtime_minutes: 0,
                is_installed: true,
                install_dir: inst_info.install_dir.clone(),
                size_on_disk: inst_info.size_on_disk,
            });
        }
    }

    // Sort by playtime descending
    games.sort_by(|a, b| b.playtime_minutes.cmp(&a.playtime_minutes));

    Ok(games)
}

#[derive(Debug)]
struct InstalledInfo {
    name: Option<String>,
    install_dir: Option<String>,
    size_on_disk: Option<u64>,
}

/// Owned app info from localconfig.vdf.
#[derive(Debug, Clone)]
struct OwnedInfo {
    playtime_minutes: u64,
    name: Option<String>,
}

/// Read owned app IDs + playtime + names from all users' localconfig.vdf.
///
/// The path is `Steam/userdata/{steamId32}/config/localconfig.vdf`.
/// Inside, `UserLocalConfigStore.Software.Valve.Steam.apps` contains
/// keys that are app IDs, each with `Playtime` and `name` fields.
fn read_owned_apps(userdata_dir: &std::path::Path) -> Result<HashMap<u32, OwnedInfo>> {
    let mut result = HashMap::new();

    if !userdata_dir.exists() {
        return Ok(result);
    }

    for entry in fs::read_dir(userdata_dir).map_err(SteamError::Io)? {
        let entry = entry.map_err(SteamError::Io)?;
        if !entry.path().is_dir() {
            continue;
        }

        let localconfig = entry.path().join("config").join("localconfig.vdf");
        if !localconfig.exists() {
            continue;
        }

        let content = fs::read_to_string(&localconfig).map_err(SteamError::Io)?;
        let root = match parse_vdf(&content) {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Navigate: UserLocalConfigStore → Software → Valve → Steam → apps
        let apps = root.navigate(&["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"]);

        if let Some(apps_map) = apps.and_then(|a| a.as_map()) {
            for (app_id_str, app_data) in apps_map {
                let app_id: u32 = match app_id_str.parse() {
                    Ok(id) => id,
                    Err(_) => continue,
                };

                let minutes = app_data
                    .get("Playtime")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);

                let name = app_data
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                result
                    .entry(app_id)
                    .and_modify(|existing| {
                        if minutes > existing.playtime_minutes {
                            existing.playtime_minutes = minutes;
                        }
                        if name.is_some() && existing.name.is_none() {
                            existing.name = name.clone();
                        }
                    })
                    .or_insert(OwnedInfo {
                        playtime_minutes: minutes,
                        name,
                    });
            }
        }
    }

    Ok(result)
}

/// Read installed apps from all library folders' appmanifest files.
fn read_installed_apps(
    install: &crate::local::steam_path::SteamInstallation,
) -> Result<HashMap<u32, InstalledInfo>> {
    let mut result = HashMap::new();

    // Read libraryfolders.vdf to get all library paths
    let libraryfolders = install.path.join("steamapps").join("libraryfolders.vdf");
    let mut library_paths = vec![install.path.join("steamapps")];

    if libraryfolders.exists() {
        let content = fs::read_to_string(&libraryfolders).map_err(SteamError::Io)?;
        if let Ok(root) = parse_vdf(&content) {
            // libraryfolders has a top-level "libraryfolders" key
            if let Some(libs) = root.get("libraryfolders") {
                if let Some(entries) = libs.as_map() {
                    for (_idx, lib_data) in entries {
                        if let Some(path) = lib_data.get("path").and_then(|v| v.as_str()) {
                            library_paths.push(std::path::PathBuf::from(path).join("steamapps"));
                        }
                    }
                }
            }
        }
    }

    for lib_path in &library_paths {
        if !lib_path.exists() {
            continue;
        }
        let pattern = lib_path.join("appmanifest_*.acf");
        let pattern_str = pattern.to_string_lossy();

        // Use glob pattern via read_dir
        if let Ok(dir_entries) = fs::read_dir(lib_path) {
            for entry in dir_entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if !name_str.starts_with("appmanifest_") || !name_str.ends_with(".acf") {
                    continue;
                }

                let content = match fs::read_to_string(entry.path()) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                // Parse simple ACF format:
                // "AppState" { "appid" "12345" "name" "Game Name" "installdir" "Dir" "SizeOnDisk" "12345" }
                let mut app_id: Option<u32> = None;
                let mut name: Option<String> = None;
                let mut installdir: Option<String> = None;
                let mut size_on_disk: Option<u64> = None;

                for line in content.lines() {
                    let trimmed = line.trim();
                    let parts: Vec<&str> = trimmed.split('"').collect();
                    if parts.len() >= 5 {
                        match parts[1] {
                            "appid" => app_id = parts[3].parse().ok(),
                            "name" => name = Some(parts[3].to_string()),
                            "installdir" => installdir = Some(parts[3].to_string()),
                            "SizeOnDisk" => size_on_disk = parts[3].parse().ok(),
                            _ => {}
                        }
                    }
                }

                if let Some(id) = app_id {
                    result.insert(
                        id,
                        InstalledInfo {
                            name,
                            install_dir: installdir,
                            size_on_disk,
                        },
                    );
                }
            }
        }
    }

    Ok(result)
}
