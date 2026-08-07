use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BackgroundAsset {
    pub source_path: String,
    #[serde(default)]
    pub thumbnail_path: Option<String>,
    #[serde(default)]
    pub runtime_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    #[serde(default = "default_appearance_preset")]
    pub preset: String,
    #[serde(default)]
    pub background_image: Option<String>,
    #[serde(default = "default_appearance_background_choice")]
    pub background_choice: String,
    #[serde(default)]
    pub custom_backgrounds: Vec<String>,
    #[serde(default)]
    pub custom_background_assets: Vec<BackgroundAsset>,
    #[serde(default)]
    pub follow_background_text: bool,
    #[serde(default)]
    pub use_liquid_glass: bool,
    #[serde(default = "default_appearance_auto_darken")]
    pub auto_darken: bool,
    #[serde(default = "default_appearance_overlay_opacity")]
    pub overlay_opacity: f64,
    #[serde(default)]
    pub background_blur: f64,
    #[serde(default = "default_appearance_surface_opacity")]
    pub surface_opacity: f64,
    #[serde(default)]
    pub surface_blur: f64,
    #[serde(default = "default_appearance_radius")]
    pub radius: f64,
    #[serde(default = "default_appearance_font_family")]
    pub font_family: String,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            preset: default_appearance_preset(),
            background_image: None,
            background_choice: default_appearance_background_choice(),
            custom_backgrounds: Vec::new(),
            custom_background_assets: Vec::new(),
            follow_background_text: false,
            use_liquid_glass: false,
            auto_darken: default_appearance_auto_darken(),
            overlay_opacity: default_appearance_overlay_opacity(),
            background_blur: 0.0,
            surface_opacity: default_appearance_surface_opacity(),
            surface_blur: 0.0,
            radius: default_appearance_radius(),
            font_family: default_appearance_font_family(),
        }
    }
}

/// User configuration persisted as config.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Backup storage root directory (relative to tool dir or absolute)
    pub backup_root: String,
    /// UI language: "zh" or "en"
    pub language: String,
    /// Whether auto-backup is enabled (file watcher triggers snapshots)
    pub auto_backup: bool,
    /// Debounce duration in seconds after last file change before triggering backup
    pub debounce_seconds: u64,
    /// Minimum interval in minutes between two automatic backups of the same game
    pub min_interval_minutes: u64,
    /// Whether to auto-start on system boot
    pub auto_start: bool,
    /// Periodic backup interval in minutes (0 = disabled)
    pub periodic_minutes: u64,
    /// Maximum total backup size in GB (0 = unlimited)
    #[serde(default = "default_max_backup_size_gb")]
    pub max_backup_size_gb: u64,
    /// Daily backup time in "HH:MM" format (None = disabled)
    #[serde(default)]
    pub daily_backup_time: Option<String>,
    /// Process check interval in seconds (default 5)
    #[serde(default = "default_process_check_interval")]
    pub process_check_interval_seconds: u64,
    /// Whether to auto-backup when a game process exits
    #[serde(default)]
    pub auto_backup_on_game_exit: bool,
    /// Enable enhanced UI animations (card hover lift, page entrance, data animations)
    #[serde(default)]
    pub ui_animations: bool,
    /// Steam Web API key (for inventory, achievements, etc.)
    #[serde(default)]
    pub steam_api_key: String,
    /// Cached Steam ID64 (detected from local Steam client)
    #[serde(default)]
    pub cached_steam_id: String,
    /// Theme mode: "light" | "dark" (was localStorage-only, now persisted)
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
    /// Cover card style for grid/cover views across launcher, game list, and inventory.
    #[serde(default = "default_cover_card_style")]
    pub cover_card_style: String,
    /// Global appearance settings for shell background + glass surfaces.
    #[serde(default)]
    pub appearance: AppearanceSettings,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            backup_root: "./backups".into(),
            language: "zh".into(),
            auto_backup: false,
            debounce_seconds: 15,
            min_interval_minutes: 10,
            auto_start: false,
            periodic_minutes: 0,
            max_backup_size_gb: 10,
            daily_backup_time: None,
            process_check_interval_seconds: 5,
            auto_backup_on_game_exit: false,
            ui_animations: true,
            steam_api_key: String::new(),
            cached_steam_id: String::new(),
            theme_mode: "dark".into(),
            cover_card_style: "default".into(),
            appearance: AppearanceSettings::default(),
        }
    }
}

fn default_process_check_interval() -> u64 {
    5
}

fn default_max_backup_size_gb() -> u64 {
    10
}

fn default_theme_mode() -> String {
    "dark".into()
}

fn default_cover_card_style() -> String {
    "default".into()
}

fn default_appearance_preset() -> String {
    "default".into()
}

fn default_appearance_background_choice() -> String {
    "%none".into()
}

fn default_appearance_auto_darken() -> bool {
    true
}

fn default_appearance_overlay_opacity() -> f64 {
    0.35
}

fn default_appearance_surface_opacity() -> f64 {
    1.0
}

fn default_appearance_radius() -> f64 {
    8.0
}

fn default_appearance_font_family() -> String {
    "%built-in".into()
}

/// Load config from path. Returns default if file does not exist.
pub fn load_config(path: &Path) -> Result<Config, anyhow::Error> {
    if !path.exists() {
        let cfg = Config::default();
        save_config(path, &cfg)?;
        return Ok(cfg);
    }
    let data = std::fs::read_to_string(path)?;
    let cfg: Config = serde_json::from_str(&data)?;
    Ok(cfg)
}

/// Save config to path.
pub fn save_config(path: &Path, config: &Config) -> Result<(), anyhow::Error> {
    let data = serde_json::to_string_pretty(config)?;
    std::fs::write(path, data)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_load_default_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let cfg = load_config(&path).unwrap();
        assert_eq!(cfg.language, "zh");
        assert!(!cfg.auto_backup);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut cfg = Config::default();
        cfg.language = String::from("en");
        cfg.auto_backup = true;
        save_config(&path, &cfg).unwrap();
        let loaded = load_config(&path).unwrap();
        assert_eq!(loaded.language, "en");
        assert!(loaded.auto_backup);
    }
}
