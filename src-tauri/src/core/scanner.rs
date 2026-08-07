use crate::core::db::GameEntry;
use std::path::{Path, PathBuf};

/// Detect Steam installation path from Windows registry.
pub fn detect_steam_installation() -> Option<PathBuf> {
    use winreg::enums::*;
    let hkcu = winreg::RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(steam_key) =
        hkcu.open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ | KEY_WOW64_32KEY)
    {
        if let Ok(steam_path) = steam_key.get_value::<String, _>("SteamPath") {
            let path = PathBuf::from(steam_path.replace('/', "\\"));
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
}

/// Parse Steam libraryfolders.vdf and return all library paths (including the Steam install dir).
pub fn parse_library_folders(steam_path: &Path) -> Vec<PathBuf> {
    let vdf_path = steam_path.join("steamapps").join("libraryfolders.vdf");
    let content = match std::fs::read_to_string(&vdf_path) {
        Ok(c) => c,
        Err(_) => return vec![steam_path.to_path_buf()],
    };

    let mut paths = vec![steam_path.to_path_buf()];

    // VDF is a simple key-value format. Library paths appear as:
    //   "path"   "D:\\SteamLibrary"
    //   "path"   "/mnt/games/Steam"
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("\"path\"") {
            // Extract the quoted value
            let value = rest.trim().trim_matches('"').to_string();
            let path = PathBuf::from(value.replace("\\\\", "\\").replace('/', "\\"));
            if path.exists() && path != *steam_path {
                paths.push(path);
            }
        }
    }

    paths
}

/// Parse appmanifest files (*.acf) in each library folder to get installed App IDs.
/// An ACF file looks like:
///   "AppState" { "appid" "1245620" "name" "Elden Ring" ... }
pub fn parse_app_manifests(library_paths: &[PathBuf]) -> Vec<u32> {
    let mut app_ids = Vec::new();

    for lib_path in library_paths {
        let steamapps_dir = lib_path.join("steamapps");
        if !steamapps_dir.exists() {
            continue;
        }

        let entries = match std::fs::read_dir(&steamapps_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let fname = entry.file_name();
            let fname_str = fname.to_string_lossy();
            if !fname_str.starts_with("appmanifest_") || !fname_str.ends_with(".acf") {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if let Some(rest) = trimmed.strip_prefix("\"appid\"") {
                        let value = rest.trim().trim_matches('"');
                        if let Ok(id) = value.parse::<u32>() {
                            app_ids.push(id);
                        }
                        break;
                    }
                }
            }
        }
    }

    app_ids
}

/// Match detected App IDs with database entries that have a matching steam_app_id.
pub fn match_with_db<'a>(app_ids: &[u32], db: &'a [GameEntry]) -> Vec<&'a GameEntry> {
    db.iter()
        .filter(|entry| {
            if let Some(db_id) = entry.steam_app_id {
                app_ids.contains(&db_id)
            } else {
                false
            }
        })
        .collect()
}

// ─────── steamlocate exe detection ───────

/// Return a map of Steam App ID → install directory for all installed games.
pub fn detect_steam_game_install_dirs() -> std::collections::HashMap<u32, PathBuf> {
    let mut result = std::collections::HashMap::new();

    let mut steamdir = match steamlocate::SteamDir::locate() {
        Some(sd) => sd,
        None => return result,
    };

    for (app_id, app) in steamdir.apps() {
        if let Some(app) = app {
            result.insert(*app_id, app.path.clone());
        }
    }

    result
}

/// Find the most likely game executable in a directory.
/// Filters out common non-game exes (uninstallers, crash reporters, etc.).
fn find_exe_in_dir(dir: &Path) -> Option<PathBuf> {
    if !dir.exists() || !dir.is_dir() {
        return None;
    }

    let skip_patterns = [
        "unins",
        "crash",
        "error",
        "report",
        "unitycrashhandler",
        "install",
        "setup",
        "dxsetup",
        "vcredist",
        "dotnet",
    ];

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let mut candidates: Vec<PathBuf> = Vec::new();
    for entry in entries.flatten() {
        let fname = entry.file_name().to_string_lossy().to_lowercase();
        if !fname.ends_with(".exe") {
            continue;
        }
        let is_skip = skip_patterns.iter().any(|p| fname.contains(p));
        if !is_skip {
            candidates.push(entry.path());
        }
    }

    // Sort by file size descending (largest = most likely the game)
    candidates.sort_by_key(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0));
    candidates.reverse();

    // Also search one level deeper in case exes are in subdirectories
    if candidates.is_empty() {
        if let Ok(sub_entries) = std::fs::read_dir(dir) {
            for sub in sub_entries.flatten() {
                if sub.path().is_dir() {
                    if let Some(found) = find_exe_in_dir(&sub.path()) {
                        candidates.push(found);
                    }
                }
            }
        }
    }

    candidates.into_iter().next()
}

/// Find the executable path for a specific Steam App ID.
/// Uses steamlocate to get install dir, then scans for exe.
pub fn find_steam_game_exe(app_id: u32) -> Option<PathBuf> {
    let mut steamdir = steamlocate::SteamDir::locate()?;
    let app = steamdir.app(&app_id)?;
    let install_dir = &app.path;

    // Try to find exe in install dir
    find_exe_in_dir(install_dir)
}

//

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_with_db() {
        let entries = vec![
            GameEntry {
                id: "elden-ring".into(),
                name: "Elden Ring".into(),
                platforms: vec!["steam".into()],
                steam_app_id: Some(1245620),
                save_path: "%APPDATA%\\EldenRing".into(),
                notes: String::new(),
                popular: false,
            },
            GameEntry {
                id: "stardew".into(),
                name: "Stardew Valley".into(),
                platforms: vec!["steam".into()],
                steam_app_id: Some(413150),
                save_path: "%APPDATA%\\StardewValley".into(),
                notes: String::new(),
                popular: false,
            },
            GameEntry {
                id: "no-steam-id".into(),
                name: "No Steam ID Game".into(),
                platforms: vec![],
                steam_app_id: None,
                save_path: "%APPDATA%\\NoID".into(),
                notes: String::new(),
                popular: false,
            },
        ];

        let app_ids = vec![1245620, 999999];
        let matched = match_with_db(&app_ids, &entries);
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0].id, "elden-ring");
    }

    #[test]
    fn test_parse_library_folders_from_str() {
        // Test with non-existent path — should return at least the steam_path
        let dummy = PathBuf::from("C:\\nonexistent\\steam");
        let result = parse_library_folders(&dummy);
        // Falls back to at least the steam_path itself since vdf doesn't exist
        assert!(!result.is_empty());
    }
}
