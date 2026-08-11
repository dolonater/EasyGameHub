//! Steam Store API client (public endpoints).
//!
//! Covers the store's wishlist endpoint (public JSON) and `appdetails`
//! (metadata + price). No API key required; requests carry a browser-like
//! User-Agent and a store `Referer` to avoid being rejected.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;

const STORE_BASE: &str = "https://store.steampowered.com";

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
    let url = format!(
        "{}/wishlist/profiles/{}/wishlistdata/",
        STORE_BASE, steam_id64
    );
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let raw = response.into_string()?;
    // A private/invalid wishlist 302s to the storefront (an HTML page, which is
    // often rate-limited too) rather than JSON — surface that as "private" so
    // the caller falls back to the local watchlist instead of a parse error.
    let body: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Err(SteamError::NotFound("wishlist_private".into())),
    };
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
    /// True when the store marks this title as not yet released.
    pub release_date_coming_soon: bool,
    pub is_free: bool,
    pub price: Option<AppPrice>,
    /// Long HTML description (full detail requests only).
    pub detailed_description: Option<String>,
    /// "About this game" HTML.
    pub about_the_game: Option<String>,
    pub website: Option<String>,
    pub screenshots: Vec<Screenshot>,
    pub pc_requirements: Option<Requirements>,
    /// Comma-joined language names ("English, 简体中文, ..."), when available.
    pub supported_languages: Option<String>,
    pub metacritic: Option<Metacritic>,
    pub recommendations_total: Option<u64>,
    /// DLC app IDs, when the store exposes them.
    pub dlc: Vec<u32>,
}

/// A storefront screenshot (full + thumbnail URLs).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Screenshot {
    pub id: u64,
    pub path_thumbnail: Option<String>,
    pub path_full: Option<String>,
}

/// PC requirements block (HTML strings).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Requirements {
    pub minimum: Option<String>,
    pub recommended: Option<String>,
}

/// Metacritic score block.
#[derive(Debug, Clone, Deserialize)]
pub struct Metacritic {
    pub score: u64,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct Recommendations {
    #[serde(rename = "total")]
    pub total: Option<u64>,
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
    detailed_description: Option<String>,
    about_the_game: Option<String>,
    website: Option<String>,
    screenshots: Option<Vec<Screenshot>>,
    pc_requirements: Option<Requirements>,
    supported_languages: Option<serde_json::Value>,
    metacritic: Option<Metacritic>,
    recommendations: Option<Recommendations>,
    dlc: Option<Vec<u32>>,
}

#[derive(Debug, Clone, Deserialize)]
struct Genre {
    description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ReleaseDate {
    date: Option<String>,
    #[serde(default)]
    coming_soon: bool,
}

/// Build an `AppDetail` from a parsed `data` block.
fn detail_from_data(app_id: u32, data: AppDetailData) -> AppDetail {
    let supported_languages = data
        .supported_languages
        .as_ref()
        .and_then(|v| v.as_object())
        .map(|obj| {
            let mut names: Vec<&String> = obj.keys().collect();
            names.sort();
            names.into_iter().cloned().collect::<Vec<_>>().join(", ")
        });
    AppDetail {
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
        release_date: data.release_date.as_ref().and_then(|rd| rd.date.clone()),
        release_date_coming_soon: data
            .release_date
            .as_ref()
            .map(|rd| rd.coming_soon)
            .unwrap_or(false),
        is_free: data.is_free.unwrap_or(false),
        price: data.price_overview,
        detailed_description: data.detailed_description,
        about_the_game: data.about_the_game,
        website: data.website,
        screenshots: data.screenshots.unwrap_or_default(),
        pc_requirements: data.pc_requirements,
        supported_languages,
        metacritic: data.metacritic,
        recommendations_total: data.recommendations.and_then(|r| r.total),
        dlc: data.dlc.unwrap_or_default(),
    }
}

/// Fetch metadata + price for a batch of apps.
///
/// Steam's `appdetails` endpoint only returns ONE app per request: comma-
/// separated ids (`?appids=730,570`) yield `null`, and repeated params
/// (`?appids=730&appids=570`) yield only the last id. So each app is fetched
/// individually, in parallel with bounded concurrency, so a batch of N apps
/// takes roughly one request's latency. Per-app failures degrade to partial
/// data instead of failing the whole call.
///
/// Prices are pinned to the China store (`cc=cn`) so the currency is always
/// CNY instead of whatever region Steam geolocates the request to.
pub fn get_app_details(
    client: &SteamHttpClient,
    app_ids: &[u32],
    language: &str,
) -> Result<Vec<AppDetail>> {
    const PARALLELISM: usize = 8;
    let mut all = Vec::new();
    for chunk in app_ids.chunks(PARALLELISM) {
        let batch: Vec<AppDetail> = std::thread::scope(|scope| {
            let handles: Vec<_> = chunk
                .iter()
                .map(|&app_id| {
                    let client = client.clone();
                    scope.spawn(move || fetch_app_detail(&client, app_id, language))
                })
                .collect();
            handles
                .into_iter()
                .filter_map(|h| h.join().unwrap_or_default())
                .collect()
        });
        all.extend(batch);
    }
    Ok(all)
}

/// Fetch a single app's detail with one retry and a short backoff; returns
/// `None` when the request or parse fails so the caller degrades gracefully.
fn fetch_app_detail(client: &SteamHttpClient, app_id: u32, language: &str) -> Option<AppDetail> {
    let url = format!(
        "{}/api/appdetails?appids={}&l={}&cc=cn",
        STORE_BASE, app_id, language
    );
    for attempt in 0..2 {
        if let Ok(response) = client.get_with_headers(&url, &[("Referer", STORE_BASE)]) {
            if response.status() == 200 {
                if let Ok(body) = response.into_json::<HashMap<String, AppDetailResponse>>() {
                    if let Some((_, entry)) = body
                        .into_iter()
                        .find(|(key, _)| key.parse::<u32>().ok() == Some(app_id))
                    {
                        if entry.success {
                            if let Some(data) = entry.data {
                                return Some(detail_from_data(app_id, data));
                            }
                        }
                    }
                }
            }
        }
        if attempt == 0 {
            std::thread::sleep(Duration::from_millis(250));
        }
    }
    None
}

/// Fetch the full detail for a single app (metadata + price) for an explicit
/// store region (`cc`). Unlike the batch [`get_app_details`] (pinned to
/// `cc=cn`), the caller picks the country — used by the store detail page and
/// multi-region price comparison.
pub fn get_app_details_full(
    client: &SteamHttpClient,
    app_id: u32,
    language: &str,
    cc: &str,
) -> Result<AppDetail> {
    let url = format!(
        "{}/api/appdetails?appids={}&l={}&cc={}",
        STORE_BASE, app_id, language, cc
    );
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: HashMap<String, AppDetailResponse> = response.into_json()?;
    let (_, entry) = body
        .into_iter()
        .find(|(key, _)| key.parse::<u32>().ok() == Some(app_id))
        .ok_or_else(|| SteamError::NotFound(format!("app {} not found", app_id)))?;
    if !entry.success {
        return Err(SteamError::NotFound(format!("app {} unavailable", app_id)));
    }
    let data = entry
        .data
        .ok_or_else(|| SteamError::NotFound(format!("app {} has no data", app_id)))?;
    Ok(detail_from_data(app_id, data))
}

/// Fetch just the price block for an app in a given store region (`cc`).
/// Returns `Ok(None)` when the app is unreleased / free / region-blocked.
pub fn get_app_price_in_region(
    client: &SteamHttpClient,
    app_id: u32,
    cc: &str,
) -> Result<Option<AppPrice>> {
    let url = format!(
        "{}/api/appdetails?appids={}&l=schinese&cc={}",
        STORE_BASE, app_id, cc
    );
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: HashMap<String, AppDetailResponse> = response.into_json()?;
    let (_, entry) = body
        .into_iter()
        .find(|(key, _)| key.parse::<u32>().ok() == Some(app_id))
        .ok_or_else(|| SteamError::NotFound(format!("app {} not found", app_id)))?;
    if !entry.success {
        return Ok(None);
    }
    Ok(entry.data.and_then(|data| data.price_overview))
}

// ── Store search ────────────────────────────────────────────

/// A single hit from the store search API (`/api/storesearch`).
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub app_id: u32,
    pub name: String,
    pub tiny_image: Option<String>,
    /// Current price in base units (cents for decimal currencies), if any.
    pub final_price: Option<u64>,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct StoreSearchResponse {
    items: Vec<StoreSearchItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct StoreSearchItem {
    r#type: String,
    id: u32,
    name: Option<String>,
    tiny_image: Option<String>,
    price: Option<StoreSearchPrice>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct StoreSearchPrice {
    #[serde(rename = "final")]
    final_price: Option<u64>,
    currency: Option<String>,
}

/// Search the Steam store by name. Pinned to the China store (`cc=cn`) so
/// prices come back in CNY. Returns only `app` hits (no bundles/subs).
pub fn search_games(
    client: &SteamHttpClient,
    term: &str,
    language: &str,
) -> Result<Vec<SearchResult>> {
    let url = format!(
        "{}/api/storesearch/?term={}&l={}&cc=cn",
        STORE_BASE,
        percent_encode(term),
        language
    );
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: StoreSearchResponse = response.into_json()?;
    Ok(body
        .items
        .into_iter()
        .filter(|item| item.r#type == "app")
        .map(|item| SearchResult {
            app_id: item.id,
            name: item.name.unwrap_or_default(),
            tiny_image: item.tiny_image,
            final_price: item.price.as_ref().and_then(|p| p.final_price),
            currency: item.price.as_ref().and_then(|p| p.currency.clone()),
        })
        .collect())
}

/// RFC 3986 percent-encode for query terms (UTF-8 aware, covers Chinese).
fn percent_encode(input: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::new();
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push(HEX[(b >> 4) as usize] as char);
                out.push(HEX[(b & 0x0F) as usize] as char);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_percent_encode() {
        assert_eq!(percent_encode("cyberpunk"), "cyberpunk");
        assert_eq!(
            percent_encode("艾尔登法环"),
            "%E8%89%BE%E5%B0%94%E7%99%BB%E6%B3%95%E7%8E%AF"
        );
        assert_eq!(percent_encode("counter strike"), "counter%20strike");
    }

    #[test]
    fn test_search_deserialize() {
        let json = r#"{
            "success": 1,
            "total": 2,
            "items": [
                {
                    "type": "app",
                    "name": "Counter-Strike 2",
                    "id": 730,
                    "tiny_image": "https://cdn.akamai.steamstatic.com/steam/apps/730/capsule_231x87.jpg",
                    "price": { "currency": "CNY", "final": 0, "initial": 0, "discount_percent": 0 }
                },
                {
                    "type": "sub",
                    "name": "CS2 Starter Bundle",
                    "id": 999,
                    "price": null
                }
            ]
        }"#;
        let body: StoreSearchResponse = serde_json::from_str(json).unwrap();
        let results: Vec<SearchResult> = body
            .items
            .into_iter()
            .filter(|item| item.r#type == "app")
            .map(|item| SearchResult {
                app_id: item.id,
                name: item.name.unwrap_or_default(),
                tiny_image: item.tiny_image,
                final_price: item.price.as_ref().and_then(|p| p.final_price),
                currency: item.price.as_ref().and_then(|p| p.currency.clone()),
            })
            .collect();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].app_id, 730);
        assert_eq!(results[0].name, "Counter-Strike 2");
        assert_eq!(results[0].final_price, Some(0));
        assert_eq!(results[0].currency.as_deref(), Some("CNY"));
    }

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
                    },
                    "detailed_description": "<h1>Long HTML</h1>",
                    "about_the_game": "<b>About</b>",
                    "website": "https://counter-strike.net",
                    "screenshots": [
                        { "id": 730001, "path_thumbnail": "https://x/ss_a_thumb.jpg", "path_full": "https://x/ss_a.jpg" }
                    ],
                    "pc_requirements": { "minimum": "<br>OS: Win10", "recommended": "<br>OS: Win11" },
                    "supported_languages": { "English": { "header": "1", "support": "2" }, "schinese": { "header": "1" } },
                    "metacritic": { "score": 92, "url": "https://metacritic.com/game/pc/counter-strike-2" },
                    "recommendations": { "total": 12345 },
                    "dlc": [730003, 730004]
                }
            },
            "999999": { "success": false, "data": null }
        }"#;
        let body: HashMap<String, AppDetailResponse> = serde_json::from_str(json).unwrap();
        let mut details = Vec::new();
        for (key, entry) in body {
            if let (Ok(app_id), Some(data)) = (key.parse::<u32>(), entry.data) {
                if entry.success {
                    details.push(detail_from_data(app_id, data));
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

        // New full-detail fields.
        assert_eq!(detail.screenshots.len(), 1);
        assert_eq!(detail.screenshots[0].id, 730001);
        assert_eq!(
            detail.pc_requirements.as_ref().unwrap().minimum.as_deref(),
            Some("<br>OS: Win10")
        );
        assert!(detail
            .supported_languages
            .as_deref()
            .unwrap()
            .contains("English"));
        assert!(detail
            .supported_languages
            .as_deref()
            .unwrap()
            .contains("schinese"));
        assert_eq!(detail.metacritic.as_ref().unwrap().score, 92);
        assert_eq!(detail.recommendations_total, Some(12345));
        assert_eq!(detail.dlc, vec![730003, 730004]);
        assert_eq!(
            detail.detailed_description.as_deref(),
            Some("<h1>Long HTML</h1>")
        );
        assert_eq!(
            detail.website.as_deref(),
            Some("https://counter-strike.net")
        );
    }
}
