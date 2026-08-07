//! Steam inventory and game library APIs.
//!
//! Calls `IPlayerService/GetOwnedGames` and related endpoints to fetch
//! the user's Steam game library.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;

/// Base URL for Steam Web API.
const STEAM_API_BASE: &str = "https://api.steampowered.com";

/// A game in the user's Steam library.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedGame {
    /// Steam App ID.
    pub appid: u32,
    /// Display name (only present when `include_appinfo=true`).
    pub name: Option<String>,
    /// Total playtime in minutes.
    pub playtime_forever: u64,
    /// Playtime in the last 2 weeks (minutes).
    pub playtime_2weeks: Option<u64>,
    /// URL for the game's icon.
    pub img_icon_url: Option<String>,
    /// URL for the game's logo.
    pub img_logo_url: Option<String>,
    /// Whether the player has community-visible stats.
    pub has_community_visible_stats: Option<bool>,
    /// Content descriptor IDs.
    pub content_descriptorids: Option<Vec<u32>>,
}

/// Response wrapper for GetOwnedGames.
#[derive(Debug, Clone, Deserialize)]
struct GetOwnedGamesResponse {
    response: OwnedGamesInner,
}

#[derive(Debug, Clone, Deserialize)]
struct OwnedGamesInner {
    game_count: u32,
    games: Vec<OwnedGame>,
}

/// Fetch the list of owned Steam games for a user.
///
/// Requires either a Steam Web API key or an OAuth access token.
///
/// # Arguments
///
/// * `steam_id` — 64-bit Steam ID of the user
/// * `api_key` — Steam Web API key (register at https://steamcommunity.com/dev/apikey)
/// * `include_appinfo` — Include game names and icons
/// * `include_played_free_games` — Include free-to-play games
pub fn get_owned_games(
    client: &SteamHttpClient,
    steam_id: u64,
    api_key: &str,
    include_appinfo: bool,
    include_played_free_games: bool,
) -> Result<Vec<OwnedGame>> {
    let url = format!(
        "{}/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&include_appinfo={}&include_played_free_games={}&format=json",
        STEAM_API_BASE,
        api_key,
        steam_id,
        include_appinfo as u8,
        include_played_free_games as u8,
    );

    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }

    let body: GetOwnedGamesResponse = response.into_json()?;
    Ok(body.response.games)
}

/// Fetch recently played games (limited to last 2 weeks).
///
/// This endpoint returns fewer fields but includes `playtime_2weeks`.
pub fn get_recently_played_games(
    client: &SteamHttpClient,
    steam_id: u64,
    api_key: &str,
) -> Result<Vec<RecentlyPlayedGame>> {
    let url = format!(
        "{}/IPlayerService/GetRecentlyPlayedGames/v1/?key={}&steamid={}&format=json",
        STEAM_API_BASE, api_key, steam_id,
    );

    #[derive(Debug, Clone, Deserialize)]
    struct Response {
        response: RecentlyPlayedInner,
    }
    #[derive(Debug, Clone, Deserialize)]
    struct RecentlyPlayedInner {
        total_count: u32,
        games: Vec<RecentlyPlayedGame>,
    }

    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }

    let body: Response = response.into_json()?;
    Ok(body.response.games)
}

/// A recently played game entry.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentlyPlayedGame {
    pub appid: u32,
    pub name: Option<String>,
    pub playtime_2weeks: u64,
    pub playtime_forever: u64,
    pub img_icon_url: Option<String>,
    pub img_logo_url: Option<String>,
}

/// Parse a SteamID64 from a string (supports both raw numbers and SteamID3).
pub fn parse_steam_id64(input: &str) -> Option<u64> {
    // Try raw parse first
    if let Ok(id) = input.parse::<u64>() {
        return if id > 76561197960265728 {
            Some(id)
        } else {
            None
        };
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_steam_id64() {
        assert_eq!(
            parse_steam_id64("76561199091385455"),
            Some(76561199091385455)
        );
        assert_eq!(parse_steam_id64("123"), None); // not a valid steam64
        assert_eq!(parse_steam_id64(""), None);
    }
}
