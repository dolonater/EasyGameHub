//! Steam achievement management (Web API).
//!
//! Reads achievement schemas and player achievement status. Achievement
//! unlocking requires the Steam client (Steamworks API) or an OAuth session
//! with write access — not yet implemented in this SDK.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
#[cfg(target_os = "windows")]
use crate::local::achievements_local;
use serde::{Deserialize, Serialize};

const STEAM_API_BASE: &str = "https://api.steampowered.com";

// ── Achievement Schema ──────────────────────────────────────

/// A single achievement definition from the game schema.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementSchemaEntry {
    /// Internal achievement name (e.g. "ACH_WIN_ONE_GAME").
    pub name: String,
    /// Default value (usually 0).
    pub defaultvalue: Option<u32>,
    /// Localized display name.
    pub display_name: String,
    /// Whether the achievement is hidden until unlocked.
    pub hidden: Option<u32>,
    /// Localized description.
    pub description: Option<String>,
    /// URL to the achievement icon (locked state).
    pub icon: Option<String>,
    /// URL to the achievement icon (unlocked state).
    pub icongray: Option<String>,
}

/// Response from GetSchemaForGame.
#[derive(Debug, Clone, Deserialize)]
struct SchemaResponse {
    game: SchemaGame,
}

#[derive(Debug, Clone, Deserialize)]
struct SchemaGame {
    #[serde(rename = "gameName")]
    game_name: String,
    #[serde(rename = "gameVersion")]
    game_version: Option<String>,
    #[serde(rename = "availableGameStats")]
    available_game_stats: Option<AvailableStats>,
}

#[derive(Debug, Clone, Deserialize)]
struct AvailableStats {
    achievements: Option<Vec<AchievementSchemaEntry>>,
}

/// Fetch the achievement schema for a game.
pub fn get_schema_for_game(
    client: &SteamHttpClient,
    app_id: u32,
    api_key: &str,
) -> Result<Vec<AchievementSchemaEntry>> {
    let url = format!(
        "{}/ISteamUserStats/GetSchemaForGame/v2/?key={}&appid={}&format=json",
        STEAM_API_BASE, api_key, app_id,
    );

    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }

    let body: SchemaResponse = response.into_json()?;
    Ok(body
        .game
        .available_game_stats
        .and_then(|s| s.achievements)
        .unwrap_or_default())
}

// ── Player Achievements ─────────────────────────────────────

/// A player's achievement status for a single achievement.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerAchievement {
    /// Internal achievement name (matches schema).
    pub apiname: String,
    /// Whether the achievement has been unlocked.
    pub achieved: u32,
    /// Unix timestamp of when it was unlocked (0 if not unlocked).
    pub unlocktime: u64,
    /// Whether the achievement is marked as achieved in the schema.
    /// This represents the locally cached state.
    pub achieved_local: Option<u32>,
}

/// Response from GetPlayerAchievements.
#[derive(Debug, Clone, Deserialize)]
struct PlayerAchievementsResponse {
    #[serde(rename = "playerstats")]
    player_stats: PlayerStats,
}

#[derive(Debug, Clone, Deserialize)]
struct PlayerStats {
    #[serde(rename = "gameName")]
    game_name: String,
    #[serde(rename = "steamID")]
    steam_id: String,
    achievements: Vec<PlayerAchievement>,
    success: Option<bool>,
}

/// Fetch a player's achievements for a game.
pub fn get_player_achievements(
    client: &SteamHttpClient,
    steam_id: u64,
    app_id: u32,
    api_key: &str,
) -> Result<Vec<PlayerAchievement>> {
    let url = format!(
        "{}/ISteamUserStats/GetPlayerAchievements/v1/?key={}&steamid={}&appid={}&format=json",
        STEAM_API_BASE, api_key, steam_id, app_id,
    );

    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }

    let body: PlayerAchievementsResponse = response.into_json()?;
    Ok(body.player_stats.achievements)
}

/// Combine schema and player achievements into a unified view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementInfo {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub hidden: bool,
    pub icon: Option<String>,
    pub icon_gray: Option<String>,
    pub achieved: bool,
    pub unlock_time: u64,
}

/// Get a merged view of all achievements for a game with display info.
pub fn get_achievements_with_info(
    client: &SteamHttpClient,
    steam_id: u64,
    app_id: u32,
    api_key: &str,
) -> Result<(f64, Vec<AchievementInfo>)> {
    let schema = get_schema_for_game(client, app_id, api_key)?;
    let player_achievements = get_player_achievements(client, steam_id, app_id, api_key)?;

    let schema_map: std::collections::HashMap<&str, &AchievementSchemaEntry> =
        schema.iter().map(|s| (s.name.as_str(), s)).collect();

    let mut achievements: Vec<AchievementInfo> = Vec::new();
    let mut unlocked = 0u32;
    let total = player_achievements.len() as u32;

    for pa in &player_achievements {
        let schema_entry = schema_map.get(pa.apiname.as_str());
        if pa.achieved != 0 {
            unlocked += 1;
        }
        achievements.push(AchievementInfo {
            name: pa.apiname.clone(),
            display_name: schema_entry
                .map(|s| s.display_name.clone())
                .unwrap_or_else(|| pa.apiname.clone()),
            description: schema_entry.and_then(|s| s.description.clone()),
            hidden: schema_entry
                .map(|s| s.hidden.unwrap_or(0) == 1)
                .unwrap_or(false),
            icon: schema_entry.and_then(|s| s.icon.clone()),
            icon_gray: schema_entry.and_then(|s| s.icongray.clone()),
            achieved: pa.achieved != 0,
            unlock_time: pa.unlocktime,
        });
    }

    let percentage = if total > 0 {
        (unlocked as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok((percentage, achievements))
}

pub fn get_achievements_local_first(
    _client: &SteamHttpClient,
    _steam_id: u64,
    app_id: u32,
) -> Result<(f64, Vec<AchievementInfo>, bool, Option<String>)> {
    #[cfg(target_os = "windows")]
    {
        return achievements_local::get_achievements_with_local_client(app_id);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(SteamError::NotFound(
            "Local achievements are currently only supported on Windows builds.".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires valid API key"]
    fn test_get_schema() {
        let client = SteamHttpClient::new();
        let schema = get_schema_for_game(&client, 730, "YOUR_API_KEY");
        // CS:GO/CS2 has achievements
        if let Ok(s) = schema {
            assert!(!s.is_empty());
        }
    }
}
