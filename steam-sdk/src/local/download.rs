//! Steam download monitoring — exact translation of SteamTools source code.
//!
//! Translated from:
//!   `BD.SteamClient/Services.Implementation/SteamServiceImpl.cs`
//!     - `FileToAppInfo()`        (lines 1058-1099)
//!     - `GetDownloadingAppList()` (lines 1101-1139)
//!     - `GetLibraryPaths()`       (lines 987-1051)
//!     - `StartWatchSteamDownloading()` (lines 1155-1263)
//!     - `StopWatchSteamDownloading()`  (lines 1251-1263)
//!   `BD.SteamClient/Models/SteamApp.cs`
//!     - `IsBitSet()`         (lines 927-930)
//!     - `CheckDownloading()` (lines 935-956)
//!     - `IsInstalled`        (lines 91-94)

use crate::error::Result;
use crate::local::steam_path::detect_steam;
use crate::vdf::parse_vdf;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

// ── SteamAppDownload (SteamTools SteamApp model for downloads) ─

/// Translated from `SteamApp.cs` — the subset of fields used for download tracking.
#[derive(Debug, Clone)]
pub struct SteamAppDownload {
    pub app_id: u32,
    pub name: Option<String>,
    /// Full install directory path: `{library}/common/{installdir}`
    pub install_dir: Option<String>,
    /// ACF `StateFlags` — see bit definitions below
    pub state: i32,
    /// Total installed size (bytes)
    pub size_on_disk: i64,
    /// Total bytes to download
    pub bytes_to_download: i64,
    /// Bytes downloaded so far
    pub bytes_downloaded: i64,
    /// Total bytes to stage/install
    pub bytes_to_stage: i64,
    /// Bytes staged/installed so far
    pub bytes_staged: i64,
    /// Last updated timestamp
    pub last_updated: i64,
}

// ── State bit logic (SteamApp.cs lines 927-956) ──────────────

/// Translated from `SteamApp.IsBitSet()` (line 927-930)
fn is_bit_set(b: i32, pos: i32) -> bool {
    (b & (1 << pos)) != 0
}

impl SteamAppDownload {
    /// Translated from `SteamApp.IsInstalled` (line 94)
    /// Bit 2 indicates if a game is installed.
    pub fn is_installed(&self) -> bool {
        is_bit_set(self.state, 2)
    }

    /// Translated from `SteamApp.CheckDownloading()` (lines 935-956)
    /// Returns true if the game is actively being downloaded (not paused).
    ///
    /// > Counting from zero and starting from the right:
    /// > Bit 1 indicates if a download is running
    /// > Bit 2 indicates if a game is installed
    /// > Bit 9 indicates if the download has been stopped by the user
    /// > Bit 10 (or maybe Bit 5) indicates if a DLC is downloaded for a game
    pub fn is_downloading(&self) -> bool {
        check_downloading(self.state)
    }
}

/// Translated from `SteamApp.CheckDownloading()` (lines 935-939)
pub fn check_downloading(app_state: i32) -> bool {
    (is_bit_set(app_state, 1) || is_bit_set(app_state, 10)) && !is_bit_set(app_state, 9)
}

// ── Library paths (SteamServiceImpl.GetLibraryPaths, lines 987-1051) ─

/// Translated from `SteamServiceImpl.GetLibraryPaths()` (lines 987-1051)
///
/// Collects all Steam library paths (main + libraryfolders.vdf).
pub fn get_library_paths(steam_dir: &Path) -> Result<Vec<PathBuf>> {
    const STEAMAPPS: &str = "steamapps";

    let mut paths = vec![steam_dir.join(STEAMAPPS)];

    let library_folders_path = steam_dir.join(STEAMAPPS).join("libraryfolders.vdf");
    if !library_folders_path.exists() {
        return Ok(paths);
    }

    let content = fs::read_to_string(&library_folders_path)?;
    let root = match parse_vdf(&content) {
        Ok(v) => v,
        Err(_) => return Ok(paths),
    };

    let libs = match root.get("libraryfolders") {
        Some(v) => v,
        None => return Ok(paths),
    };

    let entries = match libs.as_map() {
        Some(m) => m,
        None => return Ok(paths),
    };

    // SteamTools iterates i = 1, 2, 3... until null
    for i in 1.. {
        let key = i.to_string();
        let path_node = match entries.iter().find(|(k, _)| *k == key) {
            Some((_, v)) => v,
            None => break,
        };

        // Check mounted flag (new format): skip if mounted != "1"
        if let Some(mounted) = path_node.get("mounted").and_then(|v| v.as_str()) {
            if mounted != "1" {
                continue;
            }
        }

        if let Some(path_str) = path_node.get("path").and_then(|v| v.as_str()) {
            let lib_path = PathBuf::from(path_str).join(STEAMAPPS);
            if lib_path.exists() {
                paths.push(lib_path);
            }
        }
    }

    Ok(paths)
}

// ── ACF parsing (SteamServiceImpl.FileToAppInfo, lines 1058-1099) ─

/// Translated from `SteamServiceImpl.FileToAppInfo()` (lines 1058-1099)
///
/// Parses a single `appmanifest_*.acf` file into a `SteamAppDownload`.
pub fn file_to_app_info(filename: &Path) -> Result<SteamAppDownload> {
    // Read the ACF file
    let content = fs::read_to_string(filename)?;

    // Skip if file contains only NULL bytes (can happen after crash)
    if content.trim_matches('\0').is_empty() {
        return Err(crate::error::SteamError::General(
            "ACF file contains only null bytes".into(),
        ));
    }

    // Parse VDF (SteamTools: VdfHelper.Read(filename))
    let v = match parse_vdf(&content) {
        Ok(v) => v,
        Err(e) => return Err(crate::error::SteamError::Vdf(e)),
    };

    // Navigate to "AppState" node (ACF root wrapper)
    let app_state = v.get("AppState").unwrap_or(&v);

    // Helper: read string value (SteamTools: v["key"].ToString())
    let get_string = |key: &str| -> Option<String> {
        app_state
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };

    // Helper: read int value (SteamTools: (int)v["key"])
    let get_int = |key: &str| -> i32 {
        app_state
            .get(key)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    };

    // Helper: read long value (SteamTools: (long)v["key"])
    let get_long = |key: &str| -> i64 {
        app_state
            .get(key)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    };

    // Build installed dir path (SteamTools: Path.Combine(filenameDir, "common", installdir))
    let installdir_name = get_string("installdir");
    let install_dir = installdir_name.as_ref().map(|idir| {
        let parent = filename.parent().unwrap_or(Path::new(""));
        parent.join("common").join(idir)
    });

    Ok(SteamAppDownload {
        app_id: get_int("appid") as u32,
        name: get_string("name").or_else(|| installdir_name.clone()),
        install_dir: install_dir.map(|p| p.to_string_lossy().to_string()),
        state: get_int("StateFlags"),
        size_on_disk: get_long("SizeOnDisk"),
        bytes_to_download: get_long("BytesToDownload"),
        bytes_downloaded: get_long("BytesDownloaded"),
        bytes_to_stage: get_long("BytesToStage"),
        bytes_staged: get_long("BytesStaged"),
        last_updated: get_long("LastUpdated"),
    })
}

// ── Download list (SteamServiceImpl.GetDownloadingAppList, lines 1101-1139) ─

/// Translated from `SteamServiceImpl.GetDownloadingAppList()` (lines 1101-1139)
///
/// Scans all Steam library folders for `*.acf` files and returns the app list.
pub fn get_downloading_app_list() -> Result<Vec<SteamAppDownload>> {
    let steam_dir = match detect_steam() {
        Ok(install) => install.path,
        Err(_) => return Ok(Vec::new()),
    };

    let library_paths = get_library_paths(&steam_dir)?;
    if library_paths.is_empty() {
        return Ok(Vec::new());
    }

    let mut apps = Vec::new();

    for lib_path in &library_paths {
        let dir = match fs::read_dir(lib_path) {
            Ok(d) => d,
            Err(_) => continue,
        };

        for entry in dir.flatten() {
            let path = entry.path();
            let name = entry.file_name();
            let name_str = name.to_string_lossy();

            if !name_str.ends_with(".acf") {
                continue;
            }

            // Skip empty files (SteamTools: fileInfo.Length == 0)
            if let Ok(meta) = entry.metadata() {
                if meta.len() == 0 {
                    continue;
                }
            }

            match file_to_app_info(&path) {
                Ok(app) => apps.push(app),
                Err(_) => continue,
            }
        }
    }

    Ok(apps)
}

// ── File Watcher (SteamServiceImpl.StartWatchSteamDownloading, lines 1155-1263) ─

/// Events emitted by the download watcher.
#[derive(Debug, Clone)]
pub enum WatchEvent {
    /// An app's ACF file was changed (download progress updated).
    Changed(SteamAppDownload),
    /// An app's ACF file was deleted (uninstalled).
    Deleted(u32),
}

/// Handle for the download watcher thread. Drop to stop watching.
pub struct WatchHandle {
    _stop_tx: mpsc::Sender<()>,
}

/// Translated from `SteamServiceImpl.StartWatchSteamDownloading()` (lines 1155-1263)
///
/// Starts a background thread that watches all Steam library folders for
/// `*.acf` file changes. When a file is modified, it re-parses the ACF
/// and calls `on_event` with the updated data.
///
/// Uses the `notify` crate (Rust equivalent of C# FileSystemWatcher).
pub fn start_watch_steam_downloading(
    on_event: impl Fn(WatchEvent) + Send + 'static,
) -> Result<WatchHandle> {
    use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

    let steam_dir = match detect_steam() {
        Ok(install) => install.path,
        Err(e) => return Err(e.into()),
    };

    let library_paths = get_library_paths(&steam_dir)?;
    if library_paths.is_empty() {
        return Err(crate::error::SteamError::General(
            "No Steam library folders found".into(),
        ));
    }

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (event_tx, event_rx) = mpsc::channel::<notify::Result<Event>>();

    // Create watcher
    let mut watcher = RecommendedWatcher::new(
        move |res| {
            let _ = event_tx.send(res);
        },
        Config::default(),
    )
    .map_err(|e| {
        crate::error::SteamError::General(format!("Failed to create file watcher: {}", e))
    })?;

    // Watch all library paths for .acf changes
    for lib_path in &library_paths {
        if lib_path.exists() {
            watcher
                .watch(lib_path, RecursiveMode::NonRecursive)
                .map_err(|e| {
                    crate::error::SteamError::General(format!(
                        "Failed to watch {:?}: {}",
                        lib_path, e
                    ))
                })?;
        }
    }

    // Spawn processing thread
    thread::spawn(move || {
        let poll_interval = Duration::from_secs(2); // Fallback poll

        loop {
            // Check stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Process notify events (non-blocking)
            let mut got_event = false;
            while let Ok(event_res) = event_rx.try_recv() {
                got_event = true;
                match event_res {
                    Ok(event) => {
                        match event.kind {
                            EventKind::Modify(_) | EventKind::Create(_) => {
                                for path in &event.paths {
                                    let name = path
                                        .file_name()
                                        .map(|n| n.to_string_lossy().to_string())
                                        .unwrap_or_default();
                                    if !name.ends_with(".acf") {
                                        continue;
                                    }
                                    // Retry up to 5 times with 50ms delay (SteamTools behavior)
                                    let mut app: Option<SteamAppDownload> = None;
                                    for _ in 0..5 {
                                        match file_to_app_info(path) {
                                            Ok(a) => {
                                                app = Some(a);
                                                break;
                                            }
                                            Err(_) => {
                                                thread::sleep(Duration::from_millis(50));
                                            }
                                        }
                                    }
                                    if let Some(a) = app {
                                        on_event(WatchEvent::Changed(a));
                                    }
                                }
                            }
                            EventKind::Remove(_) => {
                                for path in &event.paths {
                                    let name = path
                                        .file_name()
                                        .map(|n| n.to_string_lossy().to_string())
                                        .unwrap_or_default();
                                    if name.starts_with("appmanifest_") && name.ends_with(".acf") {
                                        // Extract app ID from filename
                                        let stem = name
                                            .strip_prefix("appmanifest_")
                                            .unwrap_or(&name)
                                            .strip_suffix(".acf")
                                            .unwrap_or("");
                                        if let Ok(id) = stem.parse::<u32>() {
                                            on_event(WatchEvent::Deleted(id));
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(_) => break,
                }
            }

            // If no events, sleep to avoid busy-wait
            if !got_event {
                thread::sleep(poll_interval);
            }
        }
    });

    Ok(WatchHandle { _stop_tx: stop_tx })
}
