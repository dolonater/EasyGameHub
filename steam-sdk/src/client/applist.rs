//! Steam App List — public API for all app names (no key required).
//!
//! Fetches `https://api.steampowered.com/ISteamApps/GetAppList/v2`
//! and caches results locally. Used as final fallback when no other
//! name source (ACF, localconfig, game index) has a name.

use crate::client::SteamHttpClient;
use crate::error::Result;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const APP_LIST_URL: &str = "https://api.steampowered.com/ISteamApps/GetAppList/v2";

#[derive(Debug, Deserialize)]
struct AppListResponse {
    applist: AppListInner,
}

#[derive(Debug, Deserialize)]
struct AppListInner {
    apps: Vec<AppEntry>,
}

#[derive(Debug, Deserialize)]
struct AppEntry {
    appid: u32,
    name: String,
}

/// Load the cached app name list, fetching from Steam API if needed.
/// Cache file: `applist.json` in the current directory.
pub fn load_app_name_map() -> Result<HashMap<u32, String>> {
    let cache_path = cache_file_path();

    // Try loading from cache first
    if let Ok(map) = load_cache(&cache_path) {
        if !map.is_empty() {
            return Ok(map);
        }
    }

    // Fetch from Steam API
    log::info!("Fetching Steam app list from API...");
    match fetch_from_api() {
        Ok(map) => {
            if !map.is_empty() {
                // Save cache
                if let Ok(json) = serde_json::to_string(&map) {
                    let _ = fs::write(&cache_path, json);
                }
            }
            Ok(map)
        }
        Err(e) => {
            // Return empty map on network error (non-fatal)
            log::warn!("Failed to fetch Steam app list: {}", e);
            Ok(HashMap::new())
        }
    }
}

fn cache_file_path() -> PathBuf {
    PathBuf::from("applist.json")
}

fn load_cache(path: &std::path::Path) -> Result<HashMap<u32, String>> {
    if !path.exists() {
        return Err(crate::error::SteamError::NotFound("no cache".into()));
    }
    let content = fs::read_to_string(path)?;
    let map: HashMap<u32, String> = serde_json::from_str(&content)?;
    Ok(map)
}

fn fetch_from_api() -> Result<HashMap<u32, String>> {
    let client = SteamHttpClient::new();
    let response = client.get(APP_LIST_URL)?;
    let body: AppListResponse = response.into_json()?;
    let map: HashMap<u32, String> = body
        .applist
        .apps
        .into_iter()
        .map(|a| (a.appid, a.name))
        .collect();
    Ok(map)
}
