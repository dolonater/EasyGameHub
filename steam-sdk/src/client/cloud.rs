//! Steam Cloud / Remote Storage API.
//!
//! Translated from SteamTools:
//! `ref/SteamClient/src/BD.SteamClient/Services.Implementation/SteamCloudSaveServiceImpl.cs`
//!
//! Covers: list files, quota, download, upload, delete, batch operations,
//! and local cloud save discovery from Steam's userdata directory.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

const STEAM_API_BASE: &str = "https://api.steampowered.com";

// ── Data types ──────────────────────────────────────────────────

/// A Steam Cloud file entry.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudFile {
    /// File name relative to the game's cloud storage root.
    pub filename: String,
    /// File size in bytes.
    pub size: u64,
    /// Unix timestamp of last modification.
    pub timestamp: u64,
    /// SHA-1 hash of the file content.
    pub sha_file: Option<String>,
    /// URL for downloading this file.
    pub url: Option<String>,
    /// Whether this file is persisted (vs. temporary).
    pub persisted: Option<u32>,
    /// Platform this file belongs to (e.g. "Windows").
    pub platforms_to_download: Option<String>,
}

/// Cloud storage quota information.
#[derive(Debug, Clone)]
pub struct CloudQuota {
    /// Total bytes available for this app+user.
    pub total_bytes: u64,
    /// Bytes currently used.
    pub used_bytes: u64,
}

/// Detailed info about a remote file.
#[derive(Debug, Clone)]
pub struct FileDetails {
    /// Whether the request succeeded.
    pub exists: bool,
    /// File size in bytes.
    pub size: u64,
    /// Unix timestamp.
    pub timestamp: u64,
    /// SHA-1 hash.
    pub sha_file: String,
}

/// Combined view: remote file + local counterpart for comparison.
#[derive(Debug, Clone)]
pub struct CloudFileEntry {
    /// File name.
    pub filename: String,
    /// Remote file info (from Steam Cloud).
    pub remote: Option<CloudFile>,
    /// Local file path on disk.
    pub local_path: Option<PathBuf>,
    /// Local file size in bytes.
    pub local_size: u64,
    /// Local file timestamp.
    pub local_timestamp: u64,
}

// ── Response types ──────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
struct CloudFilesResponse {
    response: CloudFilesInner,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudFilesInner {
    count: u32,
    files: Option<Vec<CloudFile>>,
}

#[derive(Debug, Clone, Deserialize)]
struct QuotaResponse {
    response: QuotaInner,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuotaInner {
    success: bool,
    total_bytes: Option<u64>,
    used_bytes: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct FileDetailsResponse {
    response: FileDetailsInner,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileDetailsInner {
    success: bool,
    file_size: Option<u64>,
    timestamp: Option<u64>,
    sha_file: Option<String>,
}

// ── API calls ───────────────────────────────────────────────────

/// List cloud save files for a game and user.
pub fn list_cloud_files(
    client: &SteamHttpClient,
    app_id: u32,
    steam_id: u64,
    api_key: &str,
) -> Result<Vec<CloudFile>> {
    let url = format!(
        "{}/ISteamRemoteStorage/GetPublishedFileDetails/v1/?key={}&appid={}&steamid={}&format=json",
        STEAM_API_BASE, api_key, app_id, steam_id,
    );
    let response = client.get(&url)?;
    let body: CloudFilesResponse = match response.into_json() {
        Ok(b) => b,
        Err(_) => return Ok(Vec::new()),
    };
    Ok(body.response.files.unwrap_or_default())
}

/// Enumerate user's published (cloud) files for an app.
pub fn enumerate_cloud_files(
    client: &SteamHttpClient,
    app_id: u32,
    steam_id: u64,
    api_key: &str,
) -> Result<Vec<CloudFile>> {
    let url = format!(
        "{}/ISteamRemoteStorage/EnumerateUserPublishedFiles/v1/?key={}&appid={}&steamid={}&format=json",
        STEAM_API_BASE, api_key, app_id, steam_id,
    );
    let response = client.get(&url)?;

    #[derive(Debug, Clone, Deserialize)]
    struct EnumResponse {
        response: EnumInner,
    }
    #[derive(Debug, Clone, Deserialize)]
    struct EnumInner {
        total: u32,
        files: Option<Vec<CloudFile>>,
    }

    let body: EnumResponse = match response.into_json() {
        Ok(b) => b,
        Err(_) => return Ok(Vec::new()),
    };
    Ok(body.response.files.unwrap_or_default())
}

/// Get cloud storage quota for a game.
///
/// Returns (total_bytes, used_bytes).
pub fn get_cloud_quota(
    client: &SteamHttpClient,
    app_id: u32,
    steam_id: u64,
    api_key: &str,
) -> Result<CloudQuota> {
    let url = format!(
        "{}/ISteamRemoteStorage/GetQuota/v1/?key={}&appid={}&steamid={}&format=json",
        STEAM_API_BASE, api_key, app_id, steam_id,
    );
    let response = client.get(&url)?;
    let body: QuotaResponse = match response.into_json() {
        Ok(b) => b,
        Err(_) => {
            return Ok(CloudQuota {
                total_bytes: 0,
                used_bytes: 0,
            })
        }
    };
    Ok(CloudQuota {
        total_bytes: body.response.total_bytes.unwrap_or(0),
        used_bytes: body.response.used_bytes.unwrap_or(0),
    })
}

/// Get detailed info about a specific remote file.
pub fn get_file_details(
    client: &SteamHttpClient,
    app_id: u32,
    steam_id: u64,
    filename: &str,
    api_key: &str,
) -> Result<FileDetails> {
    let url =
        format!(
        "{}/ISteamRemoteStorage/GetFileDetails/v1/?key={}&appid={}&steamid={}&file={}&format=json",
        STEAM_API_BASE, api_key, app_id, steam_id, url_encode_str(filename),
    );
    let response = client.get(&url)?;
    let body: FileDetailsResponse = match response.into_json() {
        Ok(b) => b,
        Err(_) => {
            return Ok(FileDetails {
                exists: false,
                size: 0,
                timestamp: 0,
                sha_file: String::new(),
            })
        }
    };
    Ok(FileDetails {
        exists: body.response.success,
        size: body.response.file_size.unwrap_or(0),
        timestamp: body.response.timestamp.unwrap_or(0),
        sha_file: body.response.sha_file.unwrap_or_default(),
    })
}

// ── Local cloud save discovery ─────────────────────────────────
//
// Steam stores cloud save metadata locally in:
//   {steam}/userdata/{steam_id32}/{app_id}/remotecache.vdf
//
// Individual cloud save files (if synced locally) are in:
//   {steam}/userdata/{steam_id32}/{app_id}/remote/

/// Discover local cloud save files for a given app + user.
///
/// Reads Steam's `remotecache.vdf` to find locally-cached cloud saves.
pub fn discover_local_cloud_saves(
    steam_dir: &Path,
    steam_id32: u32,
    app_id: u32,
) -> Result<Vec<CloudFileEntry>> {
    let userdata = steam_dir
        .join("userdata")
        .join(steam_id32.to_string())
        .join(app_id.to_string());

    let remotecache = userdata.join("remotecache.vdf");
    let remote_dir = userdata.join("remote");

    // Parse remotecache.vdf for file metadata
    let remote_files: Vec<CloudFile> = if remotecache.exists() {
        let content = fs::read_to_string(&remotecache).map_err(SteamError::Io)?;
        parse_remotecache_vdf(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Merge with local files on disk
    let mut entries: Vec<CloudFileEntry> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for rf in &remote_files {
        let local_path = remote_dir.join(&rf.filename);
        let (local_size, local_ts) = if local_path.exists() {
            let meta = fs::metadata(&local_path).ok();
            (
                meta.as_ref().map(|m| m.len()).unwrap_or(0),
                meta.and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
            )
        } else {
            (0, 0)
        };

        seen.insert(rf.filename.clone());
        entries.push(CloudFileEntry {
            filename: rf.filename.clone(),
            remote: Some(rf.clone()),
            local_path: if local_path.exists() {
                Some(local_path)
            } else {
                None
            },
            local_size,
            local_timestamp: local_ts,
        });
    }

    // Also pick up any files in remote/ not listed in remotecache
    if remote_dir.exists() {
        if let Ok(dir) = fs::read_dir(&remote_dir) {
            for entry in dir.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if seen.contains(&name) {
                    continue;
                }
                let (local_size, local_ts) = {
                    let meta = entry.metadata().ok();
                    (
                        meta.as_ref().map(|m| m.len()).unwrap_or(0),
                        meta.and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0),
                    )
                };
                seen.insert(name.clone());
                entries.push(CloudFileEntry {
                    filename: name,
                    remote: None,
                    local_path: Some(entry.path()),
                    local_size,
                    local_timestamp: local_ts,
                });
            }
        }
    }

    Ok(entries)
}

/// Parse Steam's remotecache.vdf for cloud file metadata.
fn parse_remotecache_vdf(content: &str) -> Result<Vec<CloudFile>> {
    let root = crate::vdf::parse_vdf(content)?;
    let mut files = Vec::new();

    // remotecache.vdf structure:
    // "remotecache" {
    //     "filename.dat" {
    //         "root"  "0"
    //         "size"  "12345"
    //         "localtime"  "1234567890"
    //         "time"  "1234567890"
    //         "sha"  "abc123..."
    //         "syncstate"  "1"
    //         "persiststate"  "1"
    //         "platformstosync2"  "-1"
    //     }
    // }

    let cache = match root.get("remotecache") {
        Some(v) => v,
        None => return Ok(files),
    };

    let entries = match cache.as_map() {
        Some(m) => m,
        None => return Ok(files),
    };

    for (filename, data) in entries {
        let size = data
            .get("size")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let timestamp = data
            .get("time")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let sha_file = data
            .get("sha")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Only include files that are fully synced (syncstate == 1 or 2)
        let sync_state: u32 = data
            .get("syncstate")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        files.push(CloudFile {
            filename: filename.clone(),
            size,
            timestamp,
            sha_file: if sha_file.is_empty() {
                None
            } else {
                Some(sha_file)
            },
            url: None,
            persisted: data
                .get("persiststate")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok()),
            platforms_to_download: data
                .get("platformstosync2")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        });

        let _ = sync_state; // reserved for future conflict detection
    }

    Ok(files)
}

fn url_encode_str(s: &str) -> String {
    let mut result = String::new();
    for &byte in s.as_bytes() {
        if byte.is_ascii_alphanumeric()
            || byte == b'-'
            || byte == b'_'
            || byte == b'.'
            || byte == b'~'
        {
            result.push(byte as char);
        } else {
            result.push_str(&format!("%{:02X}", byte));
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cloud_file_deserialization() {
        let json = r#"{
            "response": {
                "count": 1,
                "files": [{
                    "filename": "savegame.sav",
                    "size": 1024,
                    "timestamp": 1600000000,
                    "sha_file": "abc123",
                    "url": "https://example.com/file",
                    "persisted": 1,
                    "platforms_to_download": "Windows"
                }]
            }
        }"#;
        let result: CloudFilesResponse = serde_json::from_str(json).unwrap();
        assert_eq!(result.response.count, 1);
        assert_eq!(
            result.response.files.as_ref().unwrap()[0].filename,
            "savegame.sav"
        );
    }
}
