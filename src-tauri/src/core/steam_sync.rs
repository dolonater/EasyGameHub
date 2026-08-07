//! Steam data synchronization: playtime, user IDs, screenshots.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Parse Steam playtime from all localconfig.vdf files.
/// Returns HashMap<steam_app_id, played_seconds>.
pub fn parse_steam_playtime() -> Result<HashMap<u32, u64>, String> {
    let mut result = HashMap::new();

    let steamdir = steamlocate::SteamDir::locate().ok_or_else(|| "Steam not found".to_string())?;

    let userdata_dir = steamdir.path.join("userdata");
    if !userdata_dir.exists() {
        return Ok(result);
    }

    let user_dirs =
        std::fs::read_dir(&userdata_dir).map_err(|e| format!("Cannot read userdata: {}", e))?;

    for user_entry in user_dirs.flatten() {
        if !user_entry.path().is_dir() {
            continue;
        }
        let localconfig = user_entry.path().join("config").join("localconfig.vdf");
        if !localconfig.exists() {
            continue;
        }

        let content = std::fs::read_to_string(&localconfig)
            .map_err(|e| format!("Read error {}: {}", localconfig.display(), e))?;

        // Scan for appid + PlayedSeconds pairs
        // Pattern: "<appid>" ... { ... "PlayedSeconds"  "<value>"
        let mut current_appid: Option<u32> = None;
        let mut brace_depth = 0u32;

        for line in content.lines() {
            let trimmed = line.trim();

            // Track brace depth for scope
            brace_depth = brace_depth.saturating_add(trimmed.matches('{').count() as u32);
            brace_depth = brace_depth.saturating_sub(trimmed.matches('}').count() as u32);

            // Try to parse app ID from a quoted number key
            if let Some(appid) = try_parse_appid_key(trimmed) {
                current_appid = Some(appid);
            }

            // Try to parse PlayedSeconds
            if let Some(secs) = try_parse_played_seconds(trimmed) {
                if let Some(appid) = current_appid {
                    let existing = result.get(&appid).copied().unwrap_or(0);
                    result.insert(appid, existing.max(secs)); // keep max across user accounts
                }
            }
        }
    }

    Ok(result)
}

/// Try to parse a line like `"123456"` as an app ID at the app-list level.
fn try_parse_appid_key(line: &str) -> Option<u32> {
    let trimmed = line.trim();
    // Must be exactly a quoted number
    if trimmed.starts_with('"') && trimmed.ends_with('"') {
        let inner = &trimmed[1..trimmed.len() - 1];
        if let Ok(num) = inner.parse::<u32>() {
            return Some(num);
        }
    }
    None
}

/// Try to parse `"PlayedSeconds"\t\t"12345"` → Some(12345)
fn try_parse_played_seconds(line: &str) -> Option<u64> {
    let trimmed = line.trim();
    if !trimmed.contains("PlayedSeconds") {
        return None;
    }
    // Split by whitespace, find the value part
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    for (i, part) in parts.iter().enumerate() {
        if part.contains("PlayedSeconds") {
            if i + 1 < parts.len() {
                let val = parts[i + 1].trim_matches('"');
                return val.parse::<u64>().ok();
            }
        }
    }
    // Fallback: find last quoted string
    let last_quote = trimmed.rfind('"')?;
    let before_last = trimmed[..last_quote].rfind('"')?;
    let value = &trimmed[before_last + 1..last_quote];
    value.parse::<u64>().ok()
}

/// Get the userdata paths for a specific Steam app (used for screenshots).
/// Returns list of `(steam_id, screenshot_dir)` tuples.
pub fn find_steam_screenshot_dirs(app_id: u32) -> Vec<(String, PathBuf)> {
    let mut results = Vec::new();

    let steamdir = match steamlocate::SteamDir::locate() {
        Some(s) => s,
        None => return results,
    };

    let userdata_dir = steamdir.path.join("userdata");
    if !userdata_dir.exists() {
        return results;
    }

    let entries = match std::fs::read_dir(&userdata_dir) {
        Ok(e) => e,
        Err(_) => return results,
    };

    for user_entry in entries.flatten() {
        if !user_entry.path().is_dir() {
            continue;
        }
        let steam_id = user_entry.file_name().to_string_lossy().to_string();
        let screenshots_dir = user_entry
            .path()
            .join("760")
            .join("remote")
            .join(app_id.to_string())
            .join("screenshots");

        if screenshots_dir.exists() {
            results.push((steam_id, screenshots_dir));
        }
    }

    results
}

/// Scan a directory for full-size screenshot images and return them sorted by modified time descending.
pub fn scan_screenshots_dir(dir: &Path) -> Vec<PathBuf> {
    let mut images = Vec::new();
    if !dir.exists() {
        return images;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return images,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy().to_lowercase();
                if ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "bmp" {
                    images.push(path);
                }
            }
        }
    }

    // Steam stores duplicated preview images under screenshots/thumbnails.
    // Skip that subdirectory so the gallery only shows the real screenshots.

    // Sort by modified time descending
    images.sort_by_key(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok());
    images.reverse();

    images
}
