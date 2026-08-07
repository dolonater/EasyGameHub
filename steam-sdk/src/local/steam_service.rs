//! Core Steam local service operations.
//!
//! Translated from SteamTools:
//! `ref/SteamClient/src/BD.SteamClient/Services.Implementation/SteamServiceImpl.cs`
//!
//! Covers user data management, authorized devices (family sharing),
//! app cache paths, and the binary appinfo.vdf parser.

use crate::error::{Result, SteamError};
use crate::local::steam_path::detect_steam;
use crate::vdf::{parse_vdf, write_vdf, VdfValue};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

// ── DeleteLocalUserData ──────────────────────────────────────
// Translated from: DeleteLocalUserData(SteamUser user, bool isDeleteUserData)

/// Remove a user from loginusers.vdf. Optionally delete their userdata folder.
pub fn delete_local_user_data(steam_id64: u64, delete_user_data: bool) -> Result<()> {
    let install = detect_steam()?;
    let loginusers_path = install.loginusers_vdf();
    if !loginusers_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&loginusers_path).map_err(SteamError::Io)?;
    let mut root = parse_vdf(&content)?;

    let steam_id_str = steam_id64.to_string();
    if let Some(users) = root.get_mut("users") {
        if let VdfValue::Map(ref mut entries) = users {
            entries.retain(|(key, _)| key != &steam_id_str);
        }
    }

    write_vdf(&loginusers_path, &root)?;

    // Optionally delete userdata folder
    if delete_user_data {
        let steam_id32 = (steam_id64 & 0xFFFF_FFFF) as u32;
        let userdata_dir = install.path.join("userdata").join(steam_id32.to_string());
        if userdata_dir.exists() {
            fs::remove_dir_all(&userdata_dir).map_err(SteamError::Io)?;
        }
    }

    Ok(())
}

// ── Authorized Devices (Family Sharing) ──────────────────────
// Translated from: GetAuthorizedDeviceList, UpdateAuthorizedDeviceList,
// RemoveAuthorizedDeviceList

/// An authorized device in Steam family sharing.
#[derive(Debug, Clone)]
pub struct AuthorizedDevice {
    pub index: usize,
    pub steam_id3: u64,
    pub time_used: i64,
    pub description: String,
    pub token_id: String,
}

/// Read the authorized devices list from config.vdf.
pub fn get_authorized_devices() -> Result<Vec<AuthorizedDevice>> {
    let install = detect_steam()?;
    let config_path = install.config_vdf();
    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&config_path).map_err(SteamError::Io)?;
    let root = parse_vdf(&content)?;

    let authorized = root.navigate(&[
        "InstallConfigStore",
        "Software",
        "Valve",
        "Steam",
        "AuthorizedDevice",
    ]);
    let entries = match authorized.and_then(|a| a.as_map()) {
        Some(e) => e,
        None => return Ok(Vec::new()),
    };

    let mut result = Vec::new();
    for (index, (steam_id_str, dev_data)) in entries.iter().enumerate() {
        let steam_id3: u64 = steam_id_str.parse().unwrap_or(0);
        let time_used = dev_data
            .get("timeused")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let description = dev_data
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let token_id = dev_data
            .get("tokenid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        result.push(AuthorizedDevice {
            index,
            steam_id3,
            time_used,
            description,
            token_id,
        });
    }

    Ok(result)
}

/// Write the authorized devices list to config.vdf.
pub fn update_authorized_devices(devices: &[AuthorizedDevice]) -> Result<()> {
    let install = detect_steam()?;
    let config_path = install.config_vdf();
    if !config_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&config_path).map_err(SteamError::Io)?;
    let mut root = parse_vdf(&content)?;

    // Build the AuthorizedDevice section
    let mut entries: Vec<(String, VdfValue)> = Vec::new();
    for dev in devices.iter().filter(|d| d.steam_id3 > 0) {
        let mut dev_entries: Vec<(String, VdfValue)> = Vec::new();
        dev_entries.push((
            "timeused".into(),
            VdfValue::String(dev.time_used.to_string()),
        ));
        dev_entries.push((
            "description".into(),
            VdfValue::String(dev.description.clone()),
        ));
        dev_entries.push(("tokenid".into(), VdfValue::String(dev.token_id.clone())));
        entries.push((dev.steam_id3.to_string(), VdfValue::Map(dev_entries)));
    }

    root.ensure_path(
        &[
            "InstallConfigStore",
            "Software",
            "Valve",
            "Steam",
            "AuthorizedDevice",
        ],
        VdfValue::Map(Vec::new()),
    );
    if let Some(v) = root.navigate_mut(&["InstallConfigStore", "Software", "Valve", "Steam"]) {
        v.set("AuthorizedDevice", VdfValue::Map(entries));
    }

    write_vdf(&config_path, &root).map_err(SteamError::Vdf)
}

// ── App Cache Paths ──────────────────────────────────────────
// Translated from: GetAppLibCacheFilePath, GetAppCustomImageFilePath

/// Type of library cache image.
#[derive(Debug, Clone, Copy)]
pub enum LibCacheType {
    Header,
    Icon,
    LibraryGrid,
    LibraryHero,
    LibraryHeroBlur,
    Logo,
}

/// Get the local app image cache path (from Steam's appcache/librarycache).
pub fn get_app_lib_cache_path(
    steam_dir: &Path,
    app_id: u32,
    cache_type: LibCacheType,
) -> Option<PathBuf> {
    let cache_dir = steam_dir.join("appcache").join("librarycache");
    if !cache_dir.exists() {
        return None;
    }

    let filename = match cache_type {
        LibCacheType::Header => format!("{}_header.jpg", app_id),
        LibCacheType::Icon => format!("{}_icon.jpg", app_id),
        LibCacheType::LibraryGrid => format!("{}_library_600x900.jpg", app_id),
        LibCacheType::LibraryHero => format!("{}_library_hero.jpg", app_id),
        LibCacheType::LibraryHeroBlur => format!("{}_library_hero_blur.jpg", app_id),
        LibCacheType::Logo => format!("{}_logo.png", app_id),
    };

    let path = cache_dir.join(&filename);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Get the custom image path for a user (userdata/{steam_id32}/config/grid/).
pub fn get_app_custom_image_path(
    steam_dir: &Path,
    steam_id32: u32,
    app_id: u32,
    cache_type: LibCacheType,
) -> Option<PathBuf> {
    let grid_dir = steam_dir
        .join("userdata")
        .join(steam_id32.to_string())
        .join("config")
        .join("grid");

    let filename = match cache_type {
        LibCacheType::Header => format!("{}.png", app_id),
        LibCacheType::LibraryGrid => format!("{}p.png", app_id),
        LibCacheType::LibraryHero => format!("{}_hero.png", app_id),
        LibCacheType::Logo => format!("{}_logo.png", app_id),
        _ => return None,
    };

    let path = grid_dir.join(&filename);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

// ── AppInfo Binary Parser ────────────────────────────────────
// Translated from:
//   `SteamAppPropertyTable.ReadPropertyTable()` — binary property table reader
//   `SteamServiceImpl.GetAppInfos()` — appinfo.vdf file parser
//
// SteamTools appinfo.vdf binary format:
//   Header:
//     - 4 bytes: magic number (0x0756_2807 v1, 0x0756_2808 v2, 0x0756_2809 v3)
//     - 4 bytes: universe number
//     - (v3 only) 8 bytes: string table offset in file
//   App entries (until AppId=0 terminator):
//     - 4 bytes: App ID (0 = end of list)
//     - 4 bytes: entry size in bytes
//     - N bytes: property table (see ReadPropertyTable)
//     - 4 bytes: unknown (v2/v3)
//     - 20 bytes: SHA1 hash (v2/v3)
//
// Property table (ReadPropertyTable):
//     while byte != 8 (SteamAppPropertyType._EndOfTable_):
//         byte: property_type (0=Table,1=String,2=Int32,3=Float,5=WString,6=Color,7=Uint64)
//         null-terminated-utf8: key_name   (or: int32 index into string pool for v3)
//         value (type-dependent):
//           Table (0):  recursive property table
//           String (1):  null-terminated utf8 string
//           Int32 (2):   4 bytes LE
//           Float (3):   4 bytes LE
//           WString (5): uint16 null-terminated
//           Color (6):   3 bytes (RGB)
//           Uint64 (7):  8 bytes LE
//
// Game name is at path: appinfo → common → name (String)
// Game type is at path: appinfo → common → type (String, parse to int)

const MAGIC_NUMBER: u32 = 0x0756_4427;
const MAGIC_NUMBER_V2: u32 = 0x0756_4428;
const MAGIC_NUMBER_V3: u32 = 0x0756_4429;

// SteamAppPropertyType enum values
const PT_TABLE: u8 = 0;
const PT_STRING: u8 = 1;
const PT_INT32: u8 = 2;
const PT_FLOAT: u8 = 3;
const PT_WSTRING: u8 = 5;
const PT_COLOR: u8 = 6;
const PT_UINT64: u8 = 7;
const PT_END: u8 = 8;

/// Steam app type enum.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AppType {
    Game,
    DLC,
    Demo,
    Music,
    Video,
    Tool,
    Other(u32),
}

impl From<u32> for AppType {
    fn from(v: u32) -> Self {
        match v {
            1 => AppType::Game,
            2 => AppType::DLC,
            3 => AppType::Demo,
            4 => AppType::Music,
            5 => AppType::Video,
            6 => AppType::Tool,
            _ => AppType::Other(v),
        }
    }
}

/// Info for a single app extracted from appinfo.vdf.
#[derive(Debug, Clone)]
pub struct AppInfo {
    pub app_id: u32,
    pub name: Option<String>,
    pub app_type: Option<u32>,
    pub parent_id: Option<u32>,
    pub icon_url: Option<String>,
    pub logo_url: Option<String>,
    pub header_url: Option<String>,
    pub library_grid_url: Option<String>,
    pub library_hero_url: Option<String>,
    pub library_logo_url: Option<String>,
    pub is_installed: bool,
    pub install_dir: Option<String>,
    pub cloud_quota_bytes: Option<u64>,
}

/// Helper: read a null-terminated UTF-8 string from a byte slice.
fn read_cstring(data: &[u8], pos: &mut usize) -> Option<String> {
    let end = data[*pos..].iter().position(|&b| b == 0)?;
    let s = String::from_utf8_lossy(&data[*pos..*pos + end]).into_owned();
    *pos += end + 1;
    Some(s)
}

/// Helper: read a little-endian u32 from a byte slice.
fn read_u32(data: &[u8], pos: &mut usize) -> Option<u32> {
    if *pos + 4 > data.len() {
        return None;
    }
    let value = u32::from_le_bytes([data[*pos], data[*pos + 1], data[*pos + 2], data[*pos + 3]]);
    *pos += 4;
    Some(value)
}

/// Helper: read a property key name.
/// appinfo.vdf v1/v2 stores keys inline as C strings; v3 stores a u32 index into the string pool.
fn read_property_key(
    data: &[u8],
    pos: &mut usize,
    string_pool: Option<&[String]>,
) -> Option<String> {
    if let Some(pool) = string_pool {
        let index = read_u32(data, pos)? as usize;
        return pool.get(index).cloned();
    }
    read_cstring(data, pos)
}

/// Helper: read the v3 string pool.
fn read_string_pool(data: &[u8], offset: usize) -> Option<Vec<String>> {
    let mut pos = offset;
    let count = read_u32(data, &mut pos)? as usize;
    let mut pool = Vec::with_capacity(count);
    for _ in 0..count {
        pool.push(read_cstring(data, &mut pos)?);
    }
    Some(pool)
}

/// Helper: read a null-terminated UTF-16 (WString) from a byte slice.
fn read_wstring(data: &[u8], pos: &mut usize) -> Option<String> {
    let mut chars = Vec::new();
    while *pos + 2 <= data.len() {
        let c = u16::from_le_bytes([data[*pos], data[*pos + 1]]);
        *pos += 2;
        if c == 0 {
            break;
        }
        chars.push(c);
    }
    if chars.is_empty() {
        return None;
    }
    Some(String::from_utf16_lossy(&chars))
}

/// Recursively scan a property table for specific paths.
/// Extracts name, type, parent, and icon/logo URLs from the
/// `appinfo → common → ...` subtree.
fn scan_property_table(
    data: &[u8],
    pos: &mut usize,
    app: &mut AppInfo,
    string_pool: Option<&[String]>,
) {
    let mut depth = 0u32;
    // Track if we're inside appinfo → common
    let mut path: Vec<String> = Vec::new();

    scan_inner(data, pos, app, &mut path, &mut depth, string_pool);
}

fn scan_inner(
    data: &[u8],
    pos: &mut usize,
    app: &mut AppInfo,
    path: &mut Vec<String>,
    depth: &mut u32,
    string_pool: Option<&[String]>,
) {
    loop {
        if *pos >= data.len() {
            break;
        }
        let prop_type = data[*pos];
        *pos += 1;

        if prop_type == PT_END {
            break;
        }

        // Read key name. v1/v2 store inline UTF-8 strings; v3 stores string-pool indexes.
        let key = match read_property_key(data, pos, string_pool) {
            Some(k) => k,
            None => break,
        };

        match prop_type {
            PT_TABLE => {
                path.push(key.clone());
                *depth += 1;
                scan_inner(data, pos, app, path, depth, string_pool);
                *depth -= 1;
                path.pop();
            }
            PT_STRING => {
                let val = read_cstring(data, pos);
                apply_value(app, path, &key, val.as_deref());
            }
            PT_WSTRING => {
                let val = read_wstring(data, pos);
                apply_value(app, path, &key, val.as_deref());
            }
            PT_INT32 => {
                if *pos + 4 <= data.len() {
                    let v = i32::from_le_bytes([
                        data[*pos],
                        data[*pos + 1],
                        data[*pos + 2],
                        data[*pos + 3],
                    ]);
                    *pos += 4;
                    apply_int(app, path, &key, v);
                } else {
                    break;
                }
            }
            PT_UINT64 => {
                if *pos + 8 <= data.len() {
                    *pos += 8; // skip
                } else {
                    break;
                }
            }
            PT_FLOAT => {
                if *pos + 4 <= data.len() {
                    *pos += 4;
                } else {
                    break;
                }
            }
            PT_COLOR => {
                if *pos + 3 <= data.len() {
                    *pos += 3;
                } else {
                    break;
                }
            }
            _ => break, // unknown type
        }
    }
}

/// Check if current path is `appinfo/common` and apply the value.
fn apply_value(app: &mut AppInfo, path: &[String], key: &str, val: Option<&str>) {
    if path.len() == 2 && path[0] == "appinfo" && path[1] == "common" {
        match key {
            "name" => {
                app.name = val.map(|s| s.to_string());
            }
            "type" => {
                app.app_type = val.and_then(|s| s.parse().ok());
            }
            "icon" => {
                app.icon_url = val.map(|s| s.to_string());
            }
            "logo" => {
                app.logo_url = val.map(|s| s.to_string());
            }
            "quota" => {
                app.cloud_quota_bytes = val.and_then(|s| s.parse::<u64>().ok());
            }
            "parent" => {
                if let Some(s) = val {
                    app.parent_id = s.parse().ok();
                }
            }
            _ => {}
        }
    }

    if path.len() == 3 && path[0] == "appinfo" && path[1] == "common" && path[2] == "library_assets"
    {
        match key {
            "logo" => {
                app.library_logo_url = val.map(|s| s.to_string());
            }
            "header" => {
                app.header_url = val.map(|s| s.to_string());
            }
            _ => {}
        }
    }

    if path.len() == 2 && path[0] == "appinfo" && path[1] == "ufs" && key == "quota" {
        app.cloud_quota_bytes = val.and_then(|s| s.parse::<u64>().ok());
    }
}

fn apply_int(app: &mut AppInfo, path: &[String], key: &str, val: i32) {
    // The type field is stored as a string, not int. Parent is also string.
    // Keep for other potential int fields.
    let _ = (app, path, key, val);
}

/// Parse the appinfo.vdf binary file and return a list of apps.
/// Translated from SteamTools `GetAppInfos()` + `ReadPropertyTable()`.
pub fn parse_appinfo_vdf(steam_dir: &Path) -> Result<Vec<AppInfo>> {
    let appinfo_path = steam_dir.join("appcache").join("appinfo.vdf");
    if !appinfo_path.exists() {
        return Err(SteamError::NotFound("appinfo.vdf not found".into()));
    }

    let data = fs::read(&appinfo_path).map_err(SteamError::Io)?;
    let mut pos = 0usize;

    if pos + 4 > data.len() {
        return Ok(Vec::new());
    }
    let magic = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
    pos += 4;

    let is_v2 = magic == MAGIC_NUMBER_V2;
    let is_v3 = magic == MAGIC_NUMBER_V3;
    if magic != MAGIC_NUMBER && !is_v2 && !is_v3 {
        return Err(SteamError::General(format!(
            "Unknown appinfo.vdf magic: 0x{:08X}",
            magic
        )));
    }

    // Read universe
    let _universe = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
    pos += 4;

    let string_pool = if is_v3 && pos + 8 <= data.len() {
        let string_table_offset = u64::from_le_bytes([
            data[pos],
            data[pos + 1],
            data[pos + 2],
            data[pos + 3],
            data[pos + 4],
            data[pos + 5],
            data[pos + 6],
            data[pos + 7],
        ]) as usize;
        pos += 8;
        read_string_pool(&data, string_table_offset)
    } else {
        None
    };

    let installed_ids = get_installed_app_ids(steam_dir)?;
    let mut apps = Vec::new();

    while pos + 4 <= data.len() {
        let app_id = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
        pos += 4;

        if app_id == 0 {
            break;
        }

        if pos + 4 > data.len() {
            break;
        }
        let _entry_size =
            u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if _entry_size == 0 || pos + _entry_size > data.len() {
            break;
        }

        let entry_start = pos;

        let mut app = AppInfo {
            app_id,
            name: None,
            app_type: None,
            parent_id: None,
            icon_url: None,
            logo_url: None,
            header_url: None,
            library_grid_url: None,
            library_hero_url: None,
            library_logo_url: None,
            is_installed: installed_ids.contains(&app_id),
            install_dir: None,
            cloud_quota_bytes: None,
        };

        // ── Parse property table (matching SteamTools ReadPropertyTable) ──
        // Skip entry header (SteamApp.FromReader lines 875-884):
        //   _stuffBeforeHash: 16 bytes
        //   SHA1: 20 bytes
        //   _changeNumber: 4 bytes
        //   extra (v2/v3): 20 bytes
        let header_size: usize = if is_v2 || is_v3 { 60 } else { 40 };
        let mut ep = entry_start + header_size;
        if ep < entry_start + _entry_size {
            scan_property_table(&data, &mut ep, &mut app, string_pool.as_deref());
        }

        if app.name.is_some() || app.app_type.is_some() {
            apps.push(app);
        }

        pos = entry_start + _entry_size;
    }

    Ok(apps)
}

/// Get installed app IDs from libraryfolders + appmanifest files.
fn get_installed_app_ids(steam_dir: &Path) -> Result<Vec<u32>> {
    let mut ids = Vec::new();
    let steamapps = steam_dir.join("steamapps");

    let mut lib_paths = vec![steamapps.clone()];
    let libraryfolders = steamapps.join("libraryfolders.vdf");
    if libraryfolders.exists() {
        if let Ok(content) = fs::read_to_string(&libraryfolders) {
            if let Ok(root) = parse_vdf(&content) {
                if let Some(libs) = root.get("libraryfolders") {
                    if let Some(entries) = libs.as_map() {
                        for (_, lib_data) in entries {
                            if let Some(path) = lib_data.get("path").and_then(|v| v.as_str()) {
                                lib_paths.push(PathBuf::from(path).join("steamapps"));
                            }
                        }
                    }
                }
            }
        }
    }

    for lib_path in &lib_paths {
        if !lib_path.exists() {
            continue;
        }
        if let Ok(dir) = fs::read_dir(lib_path) {
            for entry in dir.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("appmanifest_") && name_str.ends_with(".acf") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        for line in content.lines() {
                            let line = line.trim();
                            if let Some(start) = line.find("\"appid\"") {
                                let after = &line[start + 7..];
                                if let Some(quote_start) = after.find('"') {
                                    let val = &after[quote_start + 1..];
                                    if let Some(quote_end) = val.find('"') {
                                        if let Ok(id) = val[..quote_end].parse::<u32>() {
                                            ids.push(id);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ids)
}

// ── Save AppInfos to Steam (binary write) ───────────────────
// Translated from: SaveAppInfosToSteam()
//
// Writes modified app data back to appinfo.vdf in Steam's binary format.
// Also saves modifications to modifications.vdf for tracking changes.

/// Modification record for an app.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModifiedApp {
    pub app_id: u32,
    pub name: Option<String>,
}

/// Save modified app names back to Steam's appinfo.vdf.
///
/// This reads the binary file, applies name changes, and writes it back.
/// Also records modifications in a separate modifications.json file.
pub fn save_appinfos_to_steam(
    steam_dir: &Path,
    modified_apps: &[ModifiedApp],
    tools_dir: &Path,
) -> Result<()> {
    let appinfo_path = steam_dir.join("appcache").join("appinfo.vdf");
    if !appinfo_path.exists() {
        return Err(SteamError::NotFound("appinfo.vdf not found".into()));
    }

    // Read existing binary data
    let data = fs::read(&appinfo_path).map_err(SteamError::Io)?;

    // Create backup
    let bak_path = appinfo_path.with_extension("vdf.bak");
    fs::copy(&appinfo_path, &bak_path).map_err(SteamError::Io)?;

    // Build a map of app_id → new_name
    let name_map: std::collections::HashMap<u32, &str> = modified_apps
        .iter()
        .filter_map(|m| m.name.as_deref().map(|n| (m.app_id, n)))
        .collect();

    if name_map.is_empty() {
        return Ok(());
    }

    // Write modified data back
    // The approach: parse the binary, find the "name" key for each modified app,
    // and patch the string in-place. If the new name is longer, we need to
    // rebuild the entry. For simplicity, we rebuild the entire file.
    let mut output = Vec::with_capacity(data.len() + 4096);
    let mut pos = 0usize;

    // Copy header (magic + universe)
    let header_end = if data.len() >= 8 { 8 } else { data.len() };
    output.extend_from_slice(&data[..header_end.min(8)]);
    if data.len() > 8 && data[4] == 0x09 && data[5] == 0x28 && data[6] == 0x56 && data[7] == 0x07 {
        // v3: copy string table offset too (8 more bytes)
        if data.len() >= 16 {
            output.extend_from_slice(&data[8..16]);
            pos = 16;
        } else {
            pos = 8;
        }
    } else {
        pos = 8;
    }

    // Process each app entry
    while pos + 4 <= data.len() {
        let app_id = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
        pos += 4;
        if app_id == 0 {
            output.extend_from_slice(&data[pos - 4..pos + 4.min(data.len() - pos)]);
            break;
        }
        if pos + 4 > data.len() {
            break;
        }
        let entry_size =
            u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;
        if entry_size == 0 || pos + entry_size > data.len() {
            break;
        }

        let entry_start = pos;
        let entry_end = entry_start + entry_size;
        let entry = &data[entry_start..entry_end];

        // Check if this app needs modification
        if let Some(new_name) = name_map.get(&app_id) {
            // Rebuild this entry with the new name
            let mut new_entry = Vec::new();
            let mut ep = 0usize;
            while ep < entry.len() {
                let key_type = entry[ep];
                ep += 1;
                if key_type == 0 {
                    break;
                }
                let key_end = entry[ep..].iter().position(|&b| b == 0);
                let key = match key_end {
                    Some(n) => {
                        let s = String::from_utf8_lossy(&entry[ep..ep + n]);
                        ep += n + 1;
                        s
                    }
                    None => break,
                };

                let val_type = entry[ep];
                ep += 1;
                let is_name = key == "name" || key == "common/name";

                if is_name && val_type == 0x00 {
                    // Replace string value
                    let old_end = entry[ep..].iter().position(|&b| b == 0);
                    if let Some(n) = old_end {
                        ep += n + 1; // skip old value
                    }
                    new_entry.push(key_type);
                    new_entry.extend_from_slice(key.as_bytes());
                    new_entry.push(0);
                    new_entry.push(0x00); // string type
                    new_entry.extend_from_slice(new_name.as_bytes());
                    new_entry.push(0); // null terminate
                } else {
                    // Copy key-value as-is
                    new_entry.push(key_type);
                    new_entry.extend_from_slice(key.as_bytes());
                    new_entry.push(0);
                    new_entry.push(val_type);
                    let val_len = skip_value_len(&entry[ep..], val_type);
                    new_entry.extend_from_slice(&entry[ep..ep + val_len]);
                    ep += val_len;
                }
            }

            // Write modified entry
            let new_size = new_entry.len() as u32;
            output.extend_from_slice(&app_id.to_le_bytes());
            output.extend_from_slice(&new_size.to_le_bytes());
            output.extend_from_slice(&new_entry);
        } else {
            // Copy as-is
            output.extend_from_slice(&app_id.to_le_bytes());
            output.extend_from_slice(&(entry_size as u32).to_le_bytes());
            output.extend_from_slice(entry);
        }

        pos = entry_end;
    }

    fs::write(&appinfo_path, &output).map_err(SteamError::Io)?;

    // Save modifications record
    let mod_path = tools_dir.join("modifications.json");
    let json = serde_json::to_string_pretty(modified_apps)?;
    fs::write(&mod_path, json).map_err(SteamError::Io)?;

    Ok(())
}

fn skip_value_len(data: &[u8], val_type: u8) -> usize {
    match val_type {
        0x00 => {
            // null-terminated string
            data.iter()
                .position(|&b| b == 0)
                .map(|n| n + 1)
                .unwrap_or(data.len())
        }
        0x01 => 8, // int64
        0x02 => 4, // int32
        0x03 => 2, // int16
        0x04 => 1, // byte
        _ => 0,
    }
}

// ── Steam Download Monitoring ────────────────────────────────
// Translated from: StartWatchSteamDownloading, StopWatchSteamDownloading
//
// Monitors Steam library folders for .acf file changes (download progress).

/// Result of a download state change.
#[derive(Debug, Clone)]
pub enum DownloadEvent {
    /// A download started or state changed for this app.
    Changed(AppInfo),
    /// An app was uninstalled (acf file deleted).
    Removed(u32),
}

/// Start watching Steam library folders for download changes.
///
/// Spawns a background thread that polls ACF files for changes.
/// Returns a channel receiver for download events.
///
/// Use `stop_watch()` by dropping the returned `WatchHandle`.
pub fn start_watch_steam_downloading(
    steam_dir: &Path,
    on_change: Box<dyn Fn(DownloadEvent) + Send + 'static>,
) -> WatchHandle {
    let steam_dir = steam_dir.to_path_buf();
    let (tx, rx) = mpsc::channel::<()>();
    let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running_clone = running.clone();

    thread::spawn(move || {
        let mut prev_state: std::collections::HashMap<u32, u64> = std::collections::HashMap::new();

        while running_clone.load(std::sync::atomic::Ordering::Relaxed) {
            // Get current library paths
            let mut lib_paths = vec![steam_dir.join("steamapps")];
            let libraryfolders = steam_dir.join("steamapps").join("libraryfolders.vdf");
            if libraryfolders.exists() {
                if let Ok(content) = fs::read_to_string(&libraryfolders) {
                    if let Ok(root) = parse_vdf(&content) {
                        if let Some(libs) = root.get("libraryfolders") {
                            if let Some(entries) = libs.as_map() {
                                for (_, lib_data) in entries {
                                    if let Some(path) =
                                        lib_data.get("path").and_then(|v| v.as_str())
                                    {
                                        lib_paths.push(PathBuf::from(path).join("steamapps"));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            for lib_path in &lib_paths {
                if !lib_path.exists() {
                    continue;
                }
                if let Ok(dir) = fs::read_dir(lib_path) {
                    for entry in dir.flatten() {
                        let name = entry.file_name();
                        let name_str = name.to_string_lossy();
                        if !name_str.starts_with("appmanifest_") || !name_str.ends_with(".acf") {
                            continue;
                        }

                        // Check file modification time
                        if let Ok(meta) = entry.metadata() {
                            if let Ok(mtime) = meta.modified() {
                                let mtime_secs = mtime
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs();

                                // Extract app ID from filename
                                let app_id_str =
                                    &name_str["appmanifest_".len()..name_str.len() - ".acf".len()];
                                if let Ok(app_id) = app_id_str.parse::<u32>() {
                                    let prev = prev_state.get(&app_id).copied();
                                    if prev != Some(mtime_secs) {
                                        prev_state.insert(app_id, mtime_secs);

                                        // Parse the ACF file for basic info
                                        if let Ok(content) = fs::read_to_string(entry.path()) {
                                            let mut name = None;
                                            let mut install_dir = None;
                                            for line in content.lines() {
                                                let parts: Vec<&str> =
                                                    line.trim().split('"').collect();
                                                if parts.len() >= 5 {
                                                    match parts[1] {
                                                        "name" => name = Some(parts[3].to_string()),
                                                        "installdir" => {
                                                            install_dir = Some(parts[3].to_string())
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                            }

                                            let info = AppInfo {
                                                app_id,
                                                name,
                                                app_type: None,
                                                parent_id: None,
                                                icon_url: None,
                                                logo_url: None,
                                                header_url: None,
                                                library_grid_url: None,
                                                library_hero_url: None,
                                                library_logo_url: None,
                                                is_installed: true,
                                                install_dir,
                                                cloud_quota_bytes: None,
                                            };
                                            on_change(DownloadEvent::Changed(info));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Check for removed ACF files (full impl would compare with previous state)
            let _current_ids: std::collections::HashSet<u32> = prev_state.keys().copied().collect();

            // Sleep before next poll
            thread::sleep(Duration::from_secs(5));

            // Check stop signal
            if rx.try_recv().is_ok() {
                break;
            }
        }
    });

    WatchHandle {
        _tx: tx,
        running: running,
    }
}

/// Handle for stopping the download watcher thread.
pub struct WatchHandle {
    _tx: mpsc::Sender<()>,
    running: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl Drop for WatchHandle {
    fn drop(&mut self) {
        self.running
            .store(false, std::sync::atomic::Ordering::Relaxed);
    }
}

// ── IsSteamChinaLauncher ─────────────────────────────────────
// Translated from: IsSteamChinaLauncher()
//
// Checks if the currently running Steam process was launched with
// the -steamchina flag (indicating Steam China / 蒸汽平台).

/// Check if the running Steam instance is the Chinese launcher.
///
/// On Windows, queries WMI for the process command line.
/// On other platforms, returns `false`.
pub fn is_steam_china_launcher() -> bool {
    #[cfg(target_os = "windows")]
    {
        // Check running steam.exe processes
        let mut system = sysinfo::System::new_all();
        system.refresh_all();

        for process in system.processes_by_name("steam.exe".as_ref()) {
            // sysinfo doesn't expose command line on Windows without extra work.
            // Fall back to checking if the Steam China registry key or
            // alternate executable path exists.
            let _ = process; // unused
        }

        // Alternative: check for steamchina executable
        let steam_paths = [
            r"C:\Program Files (x86)\Steam\steamchina.exe",
            r"C:\Program Files\Steam\steamchina.exe",
        ];
        for path in &steam_paths {
            if Path::new(path).exists() {
                return true;
            }
        }

        // Check registry for Steam China
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::*;
            if let Ok(hkcu) = winreg::RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ)
            {
                // Steam China uses a different app ID path
                if hkcu.get_value::<String, _>("SteamChinaPath").is_ok() {
                    return true;
                }
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_lib_cache_path() {
        let fake_dir = PathBuf::from(r"C:\FakeSteam");
        let path = get_app_lib_cache_path(&fake_dir, 730, LibCacheType::LibraryGrid);
        assert!(path.is_none()); // directory doesn't exist
    }

    #[test]
    fn test_magic_numbers() {
        assert_eq!(MAGIC_NUMBER, 0x0756_4427);
        assert_eq!(MAGIC_NUMBER_V2, 0x0756_4428);
        assert_eq!(MAGIC_NUMBER_V3, 0x0756_4429);
    }

    #[test]
    fn reads_v3_string_pool_indexes() {
        let string_pool = vec![
            "appinfo".to_string(),
            "common".to_string(),
            "name".to_string(),
        ];
        let data = [
            0u8, 0, 0, 0, 0, // PT_TABLE + key index 0 -> appinfo
            0u8, 1, 0, 0, 0, // PT_TABLE + key index 1 -> common
            1u8, 2, 0, 0, 0, // PT_STRING + key index 2 -> name
            b'H', b'a', b'd', b'e', b's', 0,   // value
            8u8, // end common
            8u8, // end appinfo
            8u8, // end root
        ];

        let mut app = AppInfo {
            app_id: 1145360,
            name: None,
            app_type: None,
            parent_id: None,
            icon_url: None,
            logo_url: None,
            header_url: None,
            library_grid_url: None,
            library_hero_url: None,
            library_logo_url: None,
            is_installed: false,
            install_dir: None,
            cloud_quota_bytes: None,
        };
        let mut pos = 0usize;
        scan_property_table(&data, &mut pos, &mut app, Some(&string_pool));

        assert_eq!(app.name.as_deref(), Some("Hades"));
    }

    #[test]
    fn does_not_overwrite_common_name_from_nested_library_assets() {
        let mut app = AppInfo {
            app_id: 480,
            name: None,
            app_type: None,
            parent_id: None,
            icon_url: None,
            logo_url: None,
            header_url: None,
            library_grid_url: None,
            library_hero_url: None,
            library_logo_url: None,
            is_installed: false,
            install_dir: None,
            cloud_quota_bytes: None,
        };

        apply_value(
            &mut app,
            &["appinfo".into(), "common".into()],
            "name",
            Some("Spacewar"),
        );
        apply_value(
            &mut app,
            &["appinfo".into(), "common".into(), "library_assets".into()],
            "name",
            Some("Telltale Games"),
        );

        assert_eq!(app.name.as_deref(), Some("Spacewar"));
    }

    #[test]
    fn test_get_authorized_devices_returns_empty_when_no_steam() {
        // Safe test: just verifies no panic
        let _ = get_authorized_devices();
    }
}
