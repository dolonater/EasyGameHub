use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// A single game entry in the pre-built database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEntry {
    pub id: String,
    pub name: String,
    pub platforms: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steam_app_id: Option<u32>,
    pub save_path: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub popular: bool,
}

/// Root structure of games.db.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamesDb {
    pub version: u32,
    pub games: Vec<GameEntry>,
}

// ─────── Lightweight game index (O(1) lookup, ~200KB vs 2.5MB) ───────

/// Minimal game info stored in the index for fast lookups.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameIndexEntry {
    pub name: String,
    pub steam_app_id: Option<u32>,
    pub save_path: String,
    pub popular: bool,
}

/// Fast lookup index: game_id → essential fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameIndex {
    pub version: u32,
    pub entries: HashMap<String, GameIndexEntry>,
}

/// Build index from the full database (run once, or when DB version changes).
pub fn build_game_index(db_path: &Path, index_path: &Path) -> Result<GameIndex, anyhow::Error> {
    let db = load_games_db(db_path)?;
    let mut entries = HashMap::with_capacity(db.games.len());
    for entry in &db.games {
        entries.insert(
            entry.id.clone(),
            GameIndexEntry {
                name: entry.name.clone(),
                steam_app_id: entry.steam_app_id,
                save_path: entry.save_path.clone(),
                popular: entry.popular,
            },
        );
    }
    let index = GameIndex {
        version: db.version,
        entries,
    };
    // Cache to disk
    let data = serde_json::to_string(&index)?;
    std::fs::write(index_path, &data)?;
    Ok(index)
}

/// Load the game index. Builds it if missing or explicitly requested.
/// NOTE: index is pre-built at startup via setup(). This function does NOT
/// re-parse the full 2.5MB games.db.json just to check the version — it trusts
/// the cached index. Call `build_game_index` explicitly after DB updates.
pub fn load_game_index(db_path: &Path, index_path: &Path) -> Result<GameIndex, anyhow::Error> {
    if index_path.exists() {
        if let Ok(data) = std::fs::read_to_string(index_path) {
            if let Ok(index) = serde_json::from_str::<GameIndex>(&data) {
                return Ok(index);
            }
        }
    }
    // Index missing or corrupt — build fresh
    build_game_index(db_path, index_path)
}

/// Rebuild the game index (call after DB update).
pub fn rebuild_game_index(db_path: &Path, index_path: &Path) -> Result<GameIndex, anyhow::Error> {
    build_game_index(db_path, index_path)
}

/// Look up a single game from the index (O(1)).
pub fn lookup_game<'a>(index: &'a GameIndex, game_id: &str) -> Option<&'a GameIndexEntry> {
    index.entries.get(game_id)
}

/// A user-added custom game entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomGame {
    pub id: String,
    pub name: String,
    pub save_path: String,
}

/// Root structure of custom_games.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomGames {
    #[serde(default)]
    pub games: Vec<CustomGame>,
}

impl CustomGames {
    pub fn empty() -> Self {
        Self { games: vec![] }
    }
}

/// Load the pre-built games database.
pub fn load_games_db(path: &Path) -> Result<GamesDb, anyhow::Error> {
    let data = std::fs::read_to_string(path)?;
    let db: GamesDb = serde_json::from_str(&data)?;
    Ok(db)
}

/// Load custom games from file. Returns empty list if file does not exist.
pub fn load_custom_games(path: &Path) -> Result<CustomGames, anyhow::Error> {
    if !path.exists() {
        return Ok(CustomGames::empty());
    }
    let data = std::fs::read_to_string(path)?;
    let cg: CustomGames = serde_json::from_str(&data)?;
    Ok(cg)
}

/// Save custom games to file.
pub fn save_custom_games(path: &Path, games: &CustomGames) -> Result<(), anyhow::Error> {
    let data = serde_json::to_string_pretty(games)?;
    std::fs::write(path, data)?;
    Ok(())
}

/// Resolve Windows environment variables in a save path string.
/// Supports: %APPDATA%, %LOCALAPPDATA%, %USERPROFILE%, %DOCUMENTS%
pub fn resolve_save_path(raw: &str) -> String {
    let mut result = raw.to_owned();
    let vars = [
        ("%APPDATA%", "APPDATA"),
        ("%LOCALAPPDATA%", "LOCALAPPDATA"),
        ("%USERPROFILE%", "USERPROFILE"),
        ("%DOCUMENTS%", "USERPROFILE"), // Documents is typically %USERPROFILE%\Documents
    ];
    for (placeholder, env_key) in &vars {
        if let Ok(val) = std::env::var(env_key) {
            if *env_key == "USERPROFILE" && *placeholder == "%DOCUMENTS%" {
                result = result.replace(placeholder, &format!("{}\\Documents", val));
            } else {
                result = result.replace(placeholder, &val);
            }
        }
    }
    // Normalize separators to Windows backslash
    result.replace('/', "\\")
}

// ─────── Launch configuration ───────

/// Launch configuration for a game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub game_id: String,
    pub exe_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<String>,
    #[serde(default = "default_launch_method")]
    pub launch_method: String, // "direct" | "steam_protocol"
}

fn default_launch_method() -> String {
    "direct".into()
}

/// A single play session record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaySession {
    pub game_id: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: Option<u64>,
}

/// Screenshot source directory for a game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotSource {
    pub game_id: String,
    pub source_type: String, // "steam" | "custom"
    pub directory: String,
}

// ─────── User tracking ───────

/// User preferences for monitoring, pinning, launching, and playtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserGames {
    /// Game IDs the user has explicitly added / is monitoring.
    #[serde(default)]
    pub monitored: Vec<String>,
    /// Game IDs the user has pinned to top.
    #[serde(default)]
    pub pinned: Vec<String>,
    /// Game IDs that have auto-backup enabled.
    #[serde(default)]
    pub auto_backup: Vec<String>,
    /// Path overrides: (game_id, custom_save_path).
    #[serde(default)]
    pub path_overrides: Vec<(String, String)>,
    /// Launch configurations: (game_id, exe_path, args, launch_method).
    #[serde(default)]
    pub launch_configs: Vec<LaunchConfig>,
    /// Play session records.
    #[serde(default)]
    pub play_sessions: Vec<PlaySession>,
    /// Total playtime per game: (game_id, seconds).
    #[serde(default)]
    pub total_playtime: Vec<(String, u64)>,
    /// Screenshot source directories.
    #[serde(default)]
    pub screenshot_sources: Vec<ScreenshotSource>,
    /// Favorite game IDs.
    #[serde(default)]
    pub favorites: Vec<String>,
    /// Tags per game: (game_id, [tag, ...]).
    #[serde(default)]
    pub game_tags: Vec<(String, Vec<String>)>,
    /// Steam account remarks: (steam_id64, remark).
    #[serde(default)]
    pub steam_account_remarks: Vec<(String, String)>,
}

impl UserGames {
    pub fn empty() -> Self {
        Self {
            monitored: vec![],
            pinned: vec![],
            auto_backup: vec![],
            path_overrides: vec![],
            launch_configs: vec![],
            play_sessions: vec![],
            total_playtime: vec![],
            screenshot_sources: vec![],
            favorites: vec![],
            game_tags: vec![],
            steam_account_remarks: vec![],
        }
    }

    pub fn is_monitored(&self, id: &str) -> bool {
        self.monitored.iter().any(|m| m == id)
    }

    pub fn is_pinned(&self, id: &str) -> bool {
        self.pinned.iter().any(|p| p == id)
    }

    /// Get the overridden save path for a game, if one exists.
    pub fn get_path_override(&self, id: &str) -> Option<&str> {
        self.path_overrides
            .iter()
            .find(|(oid, _)| oid == id)
            .map(|(_, path)| path.as_str())
    }

    /// Get the launch config for a game, if one exists.
    pub fn get_launch_config(&self, id: &str) -> Option<&LaunchConfig> {
        self.launch_configs.iter().find(|lc| lc.game_id == id)
    }

    /// Set or update the launch config for a game.
    pub fn set_launch_config(&mut self, config: LaunchConfig) {
        if let Some(existing) = self
            .launch_configs
            .iter_mut()
            .find(|lc| lc.game_id == config.game_id)
        {
            *existing = config;
        } else {
            self.launch_configs.push(config);
        }
    }

    /// Record a play session and update total playtime.
    pub fn record_session(&mut self, session: PlaySession) {
        if let Some(dur) = session.duration_seconds {
            if let Some((_, total)) = self
                .total_playtime
                .iter_mut()
                .find(|(id, _)| id == &session.game_id)
            {
                *total += dur;
            } else {
                self.total_playtime.push((session.game_id.clone(), dur));
            }
        }
        self.play_sessions.push(session);
    }

    /// Get total playtime for a game in seconds.
    pub fn get_playtime(&self, id: &str) -> u64 {
        self.total_playtime
            .iter()
            .find(|(gid, _)| gid == id)
            .map(|(_, secs)| *secs)
            .unwrap_or(0)
    }

    pub fn is_favorite(&self, id: &str) -> bool {
        self.favorites.iter().any(|f| f == id)
    }

    pub fn toggle_favorite(&mut self, id: &str) -> bool {
        if let Some(pos) = self.favorites.iter().position(|f| f == id) {
            self.favorites.remove(pos);
            false
        } else {
            self.favorites.push(id.to_string());
            true
        }
    }

    pub fn get_tags(&self, id: &str) -> Vec<String> {
        self.game_tags
            .iter()
            .find(|(gid, _)| gid == id)
            .map(|(_, tags)| tags.clone())
            .unwrap_or_default()
    }

    pub fn set_tags(&mut self, id: &str, tags: Vec<String>) {
        if let Some(existing) = self.game_tags.iter_mut().find(|(gid, _)| gid == id) {
            existing.1 = tags;
        } else {
            self.game_tags.push((id.to_string(), tags));
        }
    }

    pub fn get_steam_account_remark(&self, steam_id64: &str) -> Option<String> {
        self.steam_account_remarks
            .iter()
            .find(|(id, _)| id == steam_id64)
            .map(|(_, remark)| remark.clone())
            .filter(|remark| !remark.trim().is_empty())
    }

    pub fn set_steam_account_remark(&mut self, steam_id64: &str, remark: String) {
        let trimmed = remark.trim().to_string();
        if trimmed.is_empty() {
            self.remove_steam_account_remark(steam_id64);
            return;
        }

        if let Some(existing) = self
            .steam_account_remarks
            .iter_mut()
            .find(|(id, _)| id == steam_id64)
        {
            existing.1 = trimmed;
        } else {
            self.steam_account_remarks
                .push((steam_id64.to_string(), trimmed));
        }
    }

    pub fn remove_steam_account_remark(&mut self, steam_id64: &str) {
        self.steam_account_remarks
            .retain(|(id, _)| id != steam_id64);
    }

    pub fn all_tags(&self) -> Vec<String> {
        let mut set: std::collections::HashSet<String> = std::collections::HashSet::new();
        for (_, tags) in &self.game_tags {
            for t in tags {
                set.insert(t.clone());
            }
        }
        let mut result: Vec<String> = set.into_iter().collect();
        result.sort();
        result
    }
}

/// Load user games tracking file.
pub fn load_user_games(path: &Path) -> Result<UserGames, anyhow::Error> {
    if !path.exists() {
        return Ok(UserGames::empty());
    }
    let data = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&data)?)
}

/// Save user games tracking file.
pub fn save_user_games(path: &Path, ug: &UserGames) -> Result<(), anyhow::Error> {
    std::fs::write(path, serde_json::to_string_pretty(ug)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_save_path() {
        // Without env vars set, the placeholders remain
        let result = resolve_save_path(r"C:\Users\test\Saved Games");
        assert!(result.contains("Saved Games"));
    }

    #[test]
    fn test_custom_games_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("custom.json");
        let cg = CustomGames {
            games: vec![CustomGame {
                id: "test".into(),
                name: "Test".into(),
                save_path: r"C:\test".into(),
            }],
        };
        save_custom_games(&path, &cg).unwrap();
        let loaded = load_custom_games(&path).unwrap();
        assert_eq!(loaded.games.len(), 1);
        assert_eq!(loaded.games[0].name, "Test");
    }
}
