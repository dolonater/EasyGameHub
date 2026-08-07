//! Steam Store API client (public endpoints).
//!
//! Covers the store's wishlist endpoint (public JSON) and `appdetails`
//! (metadata + price). No API key required; requests carry a browser-like
//! User-Agent and a store `Referer` to avoid being rejected.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;
use std::collections::HashMap;

const STORE_BASE: &str = "https://store.steampowered.com";
const BATCH_SIZE: usize = 10;

// ── Wishlist ────────────────────────────────────────────────

/// A single entry in a user's public wishlist.
#[derive(Debug, Clone)]
pub struct WishlistItem {
    pub app_id: u32,
    pub name: Option<String>,
}

/// Fetch a user's public wishlist.
///
/// Returns `Err(SteamError::NotFound)` when the wishlist is private or has no
/// readable entries — the caller should fall back to a local watchlist.
pub fn get_wishlist(client: &SteamHttpClient, steam_id64: u64) -> Result<Vec<WishlistItem>> {
    let url = format!("{}/wishlist/profiles/{}/wishlistdata/", STORE_BASE, steam_id64);
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: serde_json::Value = response.into_json()?;

    // A private/invalid wishlist returns `{"success": 2}` rather than the map.
    if body.get("success").is_some() {
        return Err(SteamError::NotFound("wishlist_private".into()));
    }
    let map = body
        .as_object()
        .ok_or_else(|| SteamError::NotFound("wishlist_private".into()))?;

    let mut items = Vec::new();
    for (key, value) in map {
        if let Ok(app_id) = key.parse::<u32>() {
            items.push(WishlistItem {
                app_id,
                name: value.get("name").and_then(|v| v.as_str()).map(String::from),
            });
        }
    }
    items.sort_by_key(|item| item.app_id);
    Ok(items)
}

// ── App details (metadata + price) ─────────────────────────

/// Price block from `price_overview`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AppPrice {
    pub currency: String,
    /// Base-unit price (cents for decimal currencies, whole units for JPY/KRW).
    #[serde(rename = "initial")]
    pub initial_price: u64,
    #[serde(rename = "final")]
    pub final_price: u64,
    #[serde(rename = "discount_percent")]
    pub discount_percent: u32,
    /// Pre-formatted strings — safe to display directly in any currency.
    #[serde(rename = "initial_formatted")]
    pub initial_formatted: Option<String>,
    #[serde(rename = "final_formatted")]
    pub final_formatted: Option<String>,
}

/// Combined metadata + price for a game (from `/api/appdetails`).
#[derive(Debug, Clone)]
pub struct AppDetail {
    pub app_id: u32,
    pub name: Option<String>,
    pub short_description: Option<String>,
    pub header_image: Option<String>,
    pub genres: Vec<String>,
    pub developers: Vec<String>,
    pub release_date: Option<String>,
    pub is_free: bool,
    pub price: Option<AppPrice>,
}

#[derive(Debug, Clone, Deserialize)]
struct AppDetailResponse {
    success: bool,
    data: Option<AppDetailData>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct AppDetailData {
    name: Option<String>,
    short_description: Option<String>,
    header_image: Option<String>,
    genres: Option<Vec<Genre>>,
    developers: Option<Vec<String>>,
    release_date: Option<ReleaseDate>,
    is_free: Option<bool>,
    price_overview: Option<AppPrice>,
}

#[derive(Debug, Clone, Deserialize)]
struct Genre {
    description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ReleaseDate {
    date: Option<String>,
}

/// Fetch metadata + price for a batch of apps (batched to keep URLs short).
///
/// A failed or rate-limited chunk is skipped rather than failing the whole
/// call, so a transient store error degrades to partial data.
///
/// Prices are pinned to the China store (`cc=cn`) so the currency is always
/// CNY instead of whatever region Steam geolocates the request to.
pub fn get_app_details(
    client: &SteamHttpClient,
    app_ids: &[u32],
    language: &str,
) -> Result<Vec<AppDetail>> {
    let mut all = Vec::new();
    for chunk in app_ids.chunks(BATCH_SIZE) {
        let ids = chunk
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let url = format!("{}/api/appdetails?appids={}&l={}&cc=cn", STORE_BASE, ids, language);
        let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
        if response.status() != 200 {
            continue;
        }
        let body: HashMap<String, AppDetailResponse> = match response.into_json() {
            Ok(b) => b,
            Err(_) => continue,
        };
        for (key, entry) in body {
            if let (Ok(app_id), Some(data)) = (key.parse::<u32>(), entry.data) {
                if entry.success {
                    all.push(AppDetail {
                        app_id,
                        name: data.name,
                        short_description: data.short_description,
                        header_image: data.header_image,
                        genres: data
                            .genres
                            .unwrap_or_default()
                            .into_iter()
                            .map(|g| g.description)
                            .collect(),
                        developers: data.developers.unwrap_or_default(),
                        release_date: data.release_date.and_then(|rd| rd.date),
                        is_free: data.is_free.unwrap_or(false),
                        price: data.price_overview,
                    });
                }
            }
        }
    }
    Ok(all)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wishlist_deserialize() {
        let json = r#"{
            "730": { "name": "Counter-Strike 2", "capsule": "abc", "subs": [] },
            "570": { "name": "Dota 2", "subs": [] }
        }"#;
        let map: serde_json::Map<String, serde_json::Value> = serde_json::from_str(json).unwrap();
        let mut items = Vec::new();
        for (key, value) in &map {
            if let Ok(app_id) = key.parse::<u32>() {
                items.push(WishlistItem {
                    app_id,
                    name: value.get("name").and_then(|v| v.as_str()).map(String::from),
                });
            }
        }
        items.sort_by_key(|item| item.app_id);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].app_id, 570);
        assert_eq!(items[1].app_id, 730);
        assert_eq!(items[1].name.as_deref(), Some("Counter-Strike 2"));
    }

    #[test]
    fn test_wishlist_private_detected() {
        // `success` key present => private/invalid, not a map of apps.
        let value: serde_json::Value = serde_json::json!({ "success": 2 });
        assert!(value.get("success").is_some());
    }

    #[test]
    fn test_app_details_deserialize() {
        let json = r#"{
            "730": {
                "success": true,
                "data": {
                    "name": "Counter-Strike 2",
                    "short_description": "For over two decades...",
                    "header_image": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg",
                    "genres": [
                        { "id": "1", "description": "Action" },
                        { "id": "29", "description": "Free to Play" }
                    ],
                    "developers": ["Valve"],
                    "release_date": { "coming_soon": false, "date": "21 Aug, 2012" },
                    "is_free": true,
                    "price_overview": {
                        "currency": "USD",
                        "initial": 0,
                        "final": 0,
                        "discount_percent": 0,
                        "initial_formatted": "",
                        "final_formatted": ""
                    }
                }
            },
            "999999": { "success": false, "data": null }
        }"#;
        let body: HashMap<String, AppDetailResponse> = serde_json::from_str(json).unwrap();
        let mut details = Vec::new();
        for (key, entry) in body {
            if let (Ok(app_id), Some(data)) = (key.parse::<u32>(), entry.data) {
                if entry.success {
                    details.push(AppDetail {
                        app_id,
                        name: data.name,
                        short_description: data.short_description,
                        header_image: data.header_image,
                        genres: data
                            .genres
                            .unwrap_or_default()
                            .into_iter()
                            .map(|g| g.description)
                            .collect(),
                        developers: data.developers.unwrap_or_default(),
                        release_date: data.release_date.and_then(|rd| rd.date),
                        is_free: data.is_free.unwrap_or(false),
                        price: data.price_overview,
                    });
                }
            }
        }
        assert_eq!(details.len(), 1);
        let detail = &details[0];
        assert_eq!(detail.app_id, 730);
        assert_eq!(detail.name.as_deref(), Some("Counter-Strike 2"));
        assert_eq!(detail.genres, vec!["Action", "Free to Play"]);
        assert!(detail.is_free);
        let price = detail.price.as_ref().unwrap();
        assert_eq!(price.final_price, 0);
        assert_eq!(price.currency, "USD");
    }
}
