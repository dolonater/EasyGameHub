//! Steam installation detection (cross-platform).
//!
//! Detects Steam's installation directory, executable path, and user data
//! directory on Windows, Linux, and macOS.

use crate::error::{Result, SteamError};
use std::path::{Path, PathBuf};

/// Information about a detected Steam installation.
#[derive(Debug, Clone)]
pub struct SteamInstallation {
    /// Path to the Steam installation directory (e.g. `C:\Program Files (x86)\Steam`).
    pub path: PathBuf,
    /// Path to the Steam executable.
    pub exe: PathBuf,
    /// Path to the Steam userdata directory (contains per-user configs).
    pub userdata: PathBuf,
    /// Path to the Steam config directory (contains loginusers.vdf, config.vdf).
    pub config: PathBuf,
}

impl SteamInstallation {
    /// Path to `loginusers.vdf`.
    pub fn loginusers_vdf(&self) -> PathBuf {
        self.config.join("loginusers.vdf")
    }

    /// Path to `config.vdf`.
    pub fn config_vdf(&self) -> PathBuf {
        self.config.join("config.vdf")
    }

    /// Path to a user's `localconfig.vdf` by SteamID32.
    pub fn localconfig_vdf(&self, steam_id32: u32) -> PathBuf {
        self.userdata
            .join(steam_id32.to_string())
            .join("config")
            .join("localconfig.vdf")
    }
}

/// Detect the Steam installation on the current system.
///
/// Tries multiple methods in order:
/// 1. Windows: Registry (`HKCU\Software\Valve\Steam\SteamPath`)
/// 2. Linux: `~/.steam/steam` or `~/.local/share/Steam`
/// 3. macOS: `~/Library/Application Support/Steam`
/// 4. Common fallback paths
pub fn detect_steam() -> Result<SteamInstallation> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(install) = detect_windows() {
            return Ok(install);
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(install) = detect_linux() {
            return Ok(install);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(install) = detect_macos() {
            return Ok(install);
        }
    }

    Err(SteamError::NotFound(
        "Steam installation not found on this system".into(),
    ))
}

/// Detect Steam on Windows via registry.
#[cfg(target_os = "windows")]
fn detect_windows() -> Result<SteamInstallation> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu
        .open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ)
        .map_err(|_| SteamError::NotFound("Steam registry key not found".into()))?;

    let steam_path: String = steam_key
        .get_value("SteamPath")
        .map_err(|_| SteamError::NotFound("SteamPath registry value not found".into()))?;

    let path = normalize_windows_path(&steam_path);
    if !path.exists() {
        // Try common fallback paths
        for fallback in &[r"C:\Program Files (x86)\Steam", r"C:\Program Files\Steam"] {
            let fb = normalize_windows_path(fallback);
            if fb.exists() {
                return build_installation(fb);
            }
        }
        return Err(SteamError::NotFound(format!(
            "Steam path {} does not exist",
            steam_path
        )));
    }

    build_installation(path)
}

#[cfg(target_os = "windows")]
fn normalize_windows_path(path: &str) -> PathBuf {
    PathBuf::from(path.replace('/', "\\"))
}

/// Detect Steam on Linux.
#[cfg(target_os = "linux")]
fn detect_linux() -> Result<SteamInstallation> {
    let home = std::env::var("HOME").unwrap_or_default();

    for candidate in &[
        format!("{}/.steam/steam", home),
        format!("{}/.local/share/Steam", home),
    ] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return build_installation(path);
        }
    }

    Err(SteamError::NotFound("Steam not found on Linux".into()))
}

/// Detect Steam on macOS.
#[cfg(target_os = "macos")]
fn detect_macos() -> Result<SteamInstallation> {
    let home = std::env::var("HOME").unwrap_or_default();
    let path = PathBuf::from(format!("{}/Library/Application Support/Steam", home));
    if path.exists() {
        build_installation(path)
    } else {
        Err(SteamError::NotFound("Steam not found on macOS".into()))
    }
}

/// Build a `SteamInstallation` from the base Steam directory.
fn build_installation(path: PathBuf) -> Result<SteamInstallation> {
    let exe = steam_exe_path(&path);
    let userdata = path.join("userdata");
    let config = path.join("config");

    Ok(SteamInstallation {
        path,
        exe,
        userdata,
        config,
    })
}

/// Get the Steam executable path for the given installation directory.
fn steam_exe_path(steam_dir: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        steam_dir.join("steam.exe")
    }
    #[cfg(target_os = "macos")]
    {
        steam_dir.join("Contents").join("MacOS").join("steam_osx")
    }
    #[cfg(target_os = "linux")]
    {
        // On Linux, steam is typically at /usr/bin/steam (a shell script)
        // but the actual binary is in the installation dir
        let candidate = steam_dir.join("ubuntu12_32").join("steam");
        if candidate.exists() {
            candidate
        } else {
            PathBuf::from("/usr/bin/steam")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "windows")]
    fn test_detect_steam_windows() {
        let result = detect_steam();
        // May or may not have Steam installed on this machine
        if let Ok(install) = result {
            assert!(install.path.exists());
            assert!(install.exe.to_string_lossy().contains("steam"));
        }
    }

    #[test]
    fn test_build_installation() {
        let fake_path = PathBuf::from(r"C:\FakeSteam");
        // build_installation won't check existence, just constructs paths
        let result = build_installation(fake_path).unwrap();
        assert!(result.exe.to_string_lossy().contains("steam"));
        assert!(result.userdata.ends_with("userdata"));
        assert!(result.config.ends_with("config"));
    }

    #[test]
    fn test_loginusers_vdf_path() {
        let fake_path = PathBuf::from(r"C:\Steam");
        let install = build_installation(fake_path).unwrap();
        let loginusers = install.loginusers_vdf();
        assert!(loginusers.ends_with("loginusers.vdf"));
    }
}
