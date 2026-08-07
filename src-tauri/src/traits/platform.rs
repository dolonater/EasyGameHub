use serde::{Deserialize, Serialize};

/// Information about a game detected on a platform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformGame {
    pub name: String,
    pub app_id: String,
    pub install_path: String,
    pub save_path_hint: Option<String>,
}

/// Platform detector trait — pluggable game platform detection.
/// Current implementation: SteamDetector.
/// Future: Epic, GOG, Game Pass.
pub trait PlatformDetector {
    fn name(&self) -> &str;
    fn detect_installed_games(&self) -> Result<Vec<PlatformGame>, anyhow::Error>;
}

/// Steam platform detector (implementation deferred to Stage 2 detail).
pub struct SteamDetector;

impl PlatformDetector for SteamDetector {
    fn name(&self) -> &str {
        "Steam"
    }

    fn detect_installed_games(&self) -> Result<Vec<PlatformGame>, anyhow::Error> {
        // TODO: full implementation in next stage
        Ok(vec![])
    }
}
