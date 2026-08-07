//! Steamworks Web API client.
//!
//! Translated from SteamTools:
//! `ref/SteamClient/src/BD.SteamClient/Services.Implementation/SteamworksWebApiServiceImpl.cs`
//!
//! Provides user info (mini-profile with avatar + persona name) and
//! the global Steam app list.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;

// ── URL constants (from SteamApiUrls.cs) ────────────────────

/// GetAppList/v2 — full Steam app catalog.
const STEAMAPP_LIST_URL: &str = "https://api.steampowered.com/ISteamApps/GetAppList/v2";

/// Mini-profile endpoint (returns avatar URL + persona name).
const STEAM_MINIPROFILE_URL: &str = "https://steam-chat.com/miniprofile/{0}/json";

// ── Models (from SteamMiniProfile.cs, SteamApp.cs) ──────────

/// A Steam app entry from GetAppList.
#[derive(Debug, Clone, Deserialize)]
pub struct SteamApp {
    pub appid: u32,
    pub name: String,
}

/// Response wrapper for GetAppList.
#[derive(Debug, Clone, Deserialize)]
struct SteamAppsResponse {
    #[serde(rename = "applist")]
    app_list: AppList,
}

#[derive(Debug, Clone, Deserialize)]
struct AppList {
    apps: Vec<SteamApp>,
}

/// Mini-profile from steam-chat.com (SteamMiniProfile.cs).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SteamMiniProfile {
    /// Steam level.
    pub level: Option<i32>,
    /// CSS class for level badge.
    pub level_class: Option<String>,
    /// Static avatar URL.
    pub avatar_url: Option<String>,
    /// Steam persona (display) name.
    pub persona_name: Option<String>,
    /// Avatar frame URL.
    pub avatar_frame: Option<String>,
    /// Animated avatar URL.
    pub animated_avatar: Option<String>,
    /// Favorite badge.
    pub favorite_badge: Option<MiniProfileBadge>,
    /// Currently in-game info.
    pub in_game: Option<MiniProfileGame>,
    /// Profile background.
    pub profile_background: Option<MiniProfileBackground>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MiniProfileBadge {
    pub name: Option<String>,
    pub xp: Option<String>,
    pub level: Option<i32>,
    pub description: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MiniProfileGame {
    pub name: Option<String>,
    pub is_non_steam: Option<bool>,
    pub logo: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MiniProfileBackground {
    #[serde(rename = "video/webm")]
    pub video_webm: Option<String>,
    #[serde(rename = "video/mp4")]
    pub video_mp4: Option<String>,
}

/// User info combining SteamID with mini-profile (SteamUser.cs).
#[derive(Debug, Clone)]
pub struct SteamUserInfo {
    pub steam_id64: u64,
    pub steam_id32: u32,
    pub persona_name: Option<String>,
    pub avatar_url: Option<String>,
    pub level: Option<i32>,
    /// Game the user is currently in-game in, if any.
    pub in_game_name: Option<String>,
}

// ── API methods (from SteamworksWebApiServiceImpl.cs) ────────

/// Get the full Steam app list (all apps on Steam).
///
/// From `GetAllSteamAppList()`.
pub fn get_all_steam_apps(client: &SteamHttpClient) -> Result<Vec<SteamApp>> {
    let response = client.get(STEAMAPP_LIST_URL)?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: "Failed to fetch Steam app list".into(),
        });
    }
    let body: SteamAppsResponse = response.into_json()?;
    Ok(body.app_list.apps)
}

/// Get the mini-profile for a user (returns avatar URL + persona name).
///
/// From `GetUserMiniProfile(long steamId3)`.
/// The steamId3 parameter is `steamId64 & 0xFFFFFFFF` (SteamID32).
pub fn get_user_mini_profile(
    client: &SteamHttpClient,
    steam_id32: u32,
) -> Result<Option<SteamMiniProfile>> {
    let url = STEAM_MINIPROFILE_URL.replace("{0}", &steam_id32.to_string());
    let response = client.get(&url)?;
    if response.status() == 404 {
        return Ok(None);
    }
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: "Failed to fetch mini-profile".into(),
        });
    }
    let profile: SteamMiniProfile = response.into_json()?;
    Ok(Some(profile))
}

/// Get combined user info (SteamID + mini-profile).
///
/// From `GetUserInfo(long steamId64)`.
pub fn get_user_info(client: &SteamHttpClient, steam_id64: u64) -> Result<SteamUserInfo> {
    let steam_id32 = (steam_id64 & 0xFFFF_FFFF) as u32;
    let profile = get_user_mini_profile(client, steam_id32)?;

    Ok(SteamUserInfo {
        steam_id64,
        steam_id32,
        persona_name: profile.as_ref().and_then(|p| p.persona_name.clone()),
        avatar_url: profile.as_ref().and_then(|p| p.avatar_url.clone()),
        level: profile.as_ref().and_then(|p| p.level),
        in_game_name: profile
            .as_ref()
            .and_then(|p| p.in_game.as_ref())
            .and_then(|g| g.name.clone()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steam_id32_conversion() {
        let steam_id64: u64 = 76561199091385455;
        let steam_id32 = (steam_id64 & 0xFFFF_FFFF) as u32;
        // The account ID portion
        let account_id = steam_id64 & 0xFFFFFFFF;
        assert_eq!(steam_id32 as u64, account_id);
    }

    #[test]
    fn test_mini_profile_deserialize() {
        let json = r#"{
            "level": 42,
            "avatar_url": "https://avatars.steamstatic.com/abc123.jpg",
            "persona_name": "TestUser",
            "avatar_frame": null,
            "animated_avatar": null
        }"#;
        let profile: SteamMiniProfile = serde_json::from_str(json).unwrap();
        assert_eq!(profile.level, Some(42));
        assert_eq!(profile.persona_name.as_deref(), Some("TestUser"));
        assert_eq!(
            profile.avatar_url.as_deref(),
            Some("https://avatars.steamstatic.com/abc123.jpg")
        );
    }
}
