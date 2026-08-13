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
    /// Platform support flags, when present.
    pub platforms: Option<Platforms>,
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
    platforms: Option<Platforms>,
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
        platforms: data.platforms,
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
    get_app_details_in_region(client, app_ids, language, "cn")
}

/// Batch variant of [`get_app_details`] with an explicit store region (`cc`).
/// Used by storefront rails, where prices must follow the selected country.
pub fn get_app_details_in_region(
    client: &SteamHttpClient,
    app_ids: &[u32],
    language: &str,
    cc: &str,
) -> Result<Vec<AppDetail>> {
    const PARALLELISM: usize = 8;
    let mut all = Vec::new();
    for chunk in app_ids.chunks(PARALLELISM) {
        let batch: Vec<AppDetail> = std::thread::scope(|scope| {
            let handles: Vec<_> = chunk
                .iter()
                .map(|&app_id| {
                    let client = client.clone();
                    scope.spawn(move || fetch_app_detail(&client, app_id, language, cc))
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
fn fetch_app_detail(
    client: &SteamHttpClient,
    app_id: u32,
    language: &str,
    cc: &str,
) -> Option<AppDetail> {
    let url = format!(
        "{}/api/appdetails?appids={}&l={}&cc={}",
        STORE_BASE, app_id, language, cc
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
    #[serde(default)]
    total: u32,
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
    release_date: Option<String>,
    platforms: Option<Platforms>,
    metacritic_score: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct StoreSearchPrice {
    #[serde(rename = "final")]
    final_price: Option<u64>,
    #[serde(rename = "initial")]
    initial_price: Option<u64>,
    #[serde(rename = "discount_percent")]
    discount_percent: Option<u32>,
    currency: Option<String>,
}

/// Platform support flags (present on browse/search hits).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Platforms {
    pub windows: bool,
    pub mac: bool,
    pub linux: bool,
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

// ── Store browse (search + filters + pagination) ────────────

/// Sort order accepted by `/api/storesearch` (`sort_by`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrowseSort {
    Relevance,
    PriceAsc,
    PriceDesc,
    ReviewsDesc,
    ReleasedDesc,
}

impl BrowseSort {
    /// The `sort_by` value passed to the store API.
    pub fn as_param(self) -> &'static str {
        match self {
            BrowseSort::Relevance => "relevance",
            BrowseSort::PriceAsc => "Price_ASC",
            BrowseSort::PriceDesc => "Price_DESC",
            BrowseSort::ReviewsDesc => "Reviews_DESC",
            BrowseSort::ReleasedDesc => "Released_DESC",
        }
    }
}

impl Default for BrowseSort {
    fn default() -> Self {
        BrowseSort::Relevance
    }
}

/// Filters for store browsing.
#[derive(Debug, Clone)]
pub struct BrowseParams {
    /// Search term; empty/`None` browses without a query.
    pub term: Option<String>,
    /// `category1` genre id (e.g. 19 = Action).
    pub category: Option<u32>,
    pub sort: BrowseSort,
    /// When true, only discounted titles are returned.
    pub specials: bool,
    /// Store country code; defaults to `cn` (prices in CNY).
    pub cc: String,
    /// First result offset for pagination.
    pub start: u32,
    /// Number of results per page.
    pub count: u32,
}

impl Default for BrowseParams {
    fn default() -> Self {
        BrowseParams {
            term: None,
            category: None,
            sort: BrowseSort::Relevance,
            specials: false,
            cc: "cn".into(),
            start: 0,
            count: 15,
        }
    }
}

/// A single hit from a browse query (same shape as search, plus filters).
#[derive(Debug, Clone)]
pub struct BrowseItem {
    pub app_id: u32,
    pub name: String,
    pub tiny_image: Option<String>,
    /// Current price in base units (cents for decimal currencies), if any.
    pub final_price: Option<u64>,
    pub initial_price: Option<u64>,
    pub discount_percent: Option<u32>,
    pub currency: Option<String>,
    pub release_date: Option<String>,
    pub platforms: Option<Platforms>,
    pub metacritic_score: Option<u32>,
}

/// Build the `/search/results/` URL for a browse query (pure, testable).
/// This is the store search page's JSON endpoint — unlike `/api/storesearch`
/// (a term-only suggestion API), it honours tag / sort / discount filters and
/// pagination. Genres are passed as `tags` (genre tag ids like 19 = Action);
/// `category1` is the content-type filter (998 = Games) and is pinned to keep
/// DLC / demos / software out of the results.
fn build_browse_url(params: &BrowseParams) -> String {
    let mut query = String::new();
    let term = params.term.as_deref().unwrap_or("");
    query.push_str(&format!("query={}", percent_encode(term)));
    query.push_str("&l=schinese");
    query.push_str(&format!("&cc={}", params.cc));
    query.push_str(&format!("&start={}", params.start));
    query.push_str(&format!("&count={}", params.count));
    query.push_str("&category1=998");
    query.push_str("&infinite=1");
    if let Some(category) = params.category {
        query.push_str(&format!("&tags={}", category));
    }
    if params.sort != BrowseSort::Relevance {
        query.push_str(&format!("&sort_by={}", params.sort.as_param()));
    }
    if params.specials {
        query.push_str("&specials=1");
    }
    format!("{}/search/results/?{}", STORE_BASE, query)
}

#[derive(Debug, Clone, Deserialize)]
struct SearchResultsResponse {
    #[serde(default)]
    total_count: u32,
    results_html: Option<String>,
}

/// Extract app ids from the search page HTML (`data-ds-appid="..."`).
fn extract_app_ids(html: &str) -> Vec<u32> {
    const MARKER: &str = "data-ds-appid=\"";
    let mut ids = Vec::new();
    let mut rest = html;
    while let Some(pos) = rest.find(MARKER) {
        rest = &rest[pos + MARKER.len()..];
        let end = rest.find('"').unwrap_or(rest.len());
        if let Ok(id) = rest[..end].parse::<u32>() {
            ids.push(id);
        }
    }
    ids
}

/// Fetch one page of store search results with full filters (genre, sort,
/// discounts, region, pagination). Returns the total match count and the
/// page's app ids; item details are resolved by the caller via batched
/// `appdetails` (the search page HTML only carries partial display info).
pub fn search_results_page(
    client: &SteamHttpClient,
    params: &BrowseParams,
) -> Result<(u32, Vec<u32>)> {
    let url = build_browse_url(params);
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: SearchResultsResponse = response.into_json()?;
    let html = body.results_html.unwrap_or_default();
    Ok((body.total_count, extract_app_ids(&html)))
}

// ── Storefront rails (featured + categories) ────────────────

/// Steam store entry type. The storefront endpoints report it as an integer
/// code (`0` = app) or, historically, the string `"app"` — accept both.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum FeaturedType {
    App,
    #[default]
    Other,
}

impl FeaturedType {
    fn is_app(self) -> bool {
        self == FeaturedType::App
    }
}

impl<'de> Deserialize<'de> for FeaturedType {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = FeaturedType;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a Steam store type code (0 = app) or type string")
            }
            fn visit_u64<E: serde::de::Error>(self, v: u64) -> std::result::Result<Self::Value, E> {
                Ok(if v == 0 {
                    FeaturedType::App
                } else {
                    FeaturedType::Other
                })
            }
            fn visit_str<E: serde::de::Error>(
                self,
                v: &str,
            ) -> std::result::Result<Self::Value, E> {
                Ok(if v == "app" {
                    FeaturedType::App
                } else {
                    FeaturedType::Other
                })
            }
        }
        deserializer.deserialize_any(Visitor)
    }
}

/// A single entry shared by `/api/featured` (featured_win/mac/linux and
/// large_capsules arrays) and `/api/featuredcategories` (rail `items`).
/// Prices are flat fields (no `price` block) and platforms come as three
/// `*_available` booleans.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct FeaturedItem {
    pub id: u32,
    #[serde(default)]
    pub r#type: FeaturedType,
    pub name: Option<String>,
    pub discount_percent: Option<u32>,
    pub original_price: Option<u64>,
    pub final_price: Option<u64>,
    pub currency: Option<String>,
    pub small_capsule_image: Option<String>,
    pub header_image: Option<String>,
    #[serde(default)]
    pub windows_available: bool,
    #[serde(default)]
    pub mac_available: bool,
    #[serde(default)]
    pub linux_available: bool,
}

impl FeaturedItem {
    fn into_browse_item(self) -> BrowseItem {
        BrowseItem {
            app_id: self.id,
            name: self.name.unwrap_or_default(),
            tiny_image: self.small_capsule_image.or(self.header_image),
            final_price: self.final_price,
            initial_price: self.original_price,
            discount_percent: self.discount_percent,
            currency: self.currency,
            release_date: None,
            platforms: Some(Platforms {
                windows: self.windows_available,
                mac: self.mac_available,
                linux: self.linux_available,
            }),
            metacritic_score: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct FeaturedResponse {
    #[serde(default)]
    featured_win: Vec<FeaturedItem>,
    #[serde(default)]
    featured_mac: Vec<FeaturedItem>,
    #[serde(default)]
    featured_linux: Vec<FeaturedItem>,
    #[serde(default)]
    large_capsules: Vec<FeaturedItem>,
}

/// Fetch the main "featured" rail of the storefront: the featured_win / mac /
/// linux arrays plus the large capsules, merged and deduplicated by app id.
/// Items carry display info (price, platforms, images) in one request.
pub fn featured(client: &SteamHttpClient, cc: &str, language: &str) -> Result<Vec<BrowseItem>> {
    let url = format!("{}/api/featured?cc={}&l={}", STORE_BASE, cc, language);
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: FeaturedResponse = response.into_json()?;
    let mut seen = std::collections::HashSet::new();
    let mut items = Vec::new();
    for raw in body
        .featured_win
        .into_iter()
        .chain(body.featured_mac)
        .chain(body.featured_linux)
        .chain(body.large_capsules)
    {
        if raw.r#type != FeaturedType::App || !seen.insert(raw.id) {
            continue;
        }
        items.push(raw.into_browse_item());
    }
    Ok(items)
}

/// A storefront rail: curated title with full item entries (the API returns
/// complete display info per item — no separate detail lookups needed).
#[derive(Debug, Clone)]
pub struct FeaturedRail {
    pub id: String,
    pub name: Option<String>,
    pub items: Vec<FeaturedItem>,
}

#[derive(Debug, Clone, Deserialize)]
struct FeaturedCategory {
    id: String,
    name: Option<String>,
    #[serde(default)]
    items: Vec<FeaturedItem>,
}

#[derive(Debug, Clone, Deserialize)]
struct FeaturedCategoriesResponse {
    /// Kept as an alias in case the historical `specails` misspelling shows up.
    #[serde(alias = "specails")]
    specials: Option<FeaturedCategory>,
    coming_soon: Option<FeaturedCategory>,
    top_sellers: Option<FeaturedCategory>,
    new_releases: Option<FeaturedCategory>,
}

/// Fetch the storefront's curated rails (specials / coming soon / top
/// sellers / new releases). Genres and other rails are skipped.
pub fn featured_categories(
    client: &SteamHttpClient,
    cc: &str,
    language: &str,
) -> Result<Vec<FeaturedRail>> {
    let url = format!(
        "{}/api/featuredcategories/?cc={}&l={}",
        STORE_BASE, cc, language
    );
    let response = client.get_with_headers(&url, &[("Referer", STORE_BASE)])?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: FeaturedCategoriesResponse = response.into_json()?;
    let mut rails = Vec::new();
    for category in [
        body.specials,
        body.coming_soon,
        body.top_sellers,
        body.new_releases,
    ]
    .into_iter()
    .flatten()
    {
        if category.items.is_empty() {
            continue;
        }
        // The API can list the same app twice within a rail — dedupe by id
        // (keep first) so card keys stay unique.
        let mut seen = std::collections::HashSet::new();
        let items = category
            .items
            .into_iter()
            .filter(|item| seen.insert(item.id))
            .collect();
        rails.push(FeaturedRail {
            id: category.id,
            name: category.name,
            items,
        });
    }
    Ok(rails)
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

    #[test]
    fn test_sort_param_mapping() {
        assert_eq!(BrowseSort::Relevance.as_param(), "relevance");
        assert_eq!(BrowseSort::PriceAsc.as_param(), "Price_ASC");
        assert_eq!(BrowseSort::PriceDesc.as_param(), "Price_DESC");
        assert_eq!(BrowseSort::ReviewsDesc.as_param(), "Reviews_DESC");
        assert_eq!(BrowseSort::ReleasedDesc.as_param(), "Released_DESC");
    }

    #[test]
    fn test_browse_url_construction() {
        let url = build_browse_url(&BrowseParams::default());
        assert_eq!(
            url,
            "https://store.steampowered.com/search/results/?query=&l=schinese&cc=cn&start=0&count=15&category1=998&infinite=1"
        );

        let mut params = BrowseParams::default();
        params.term = Some("艾尔登法环".into());
        params.category = Some(19);
        params.sort = BrowseSort::PriceAsc;
        params.specials = true;
        params.cc = "us".into();
        params.start = 30;
        params.count = 10;
        let url = build_browse_url(&params);
        assert!(url.contains("query=%E8%89%BE%E5%B0%94%E7%99%BB%E6%B3%95%E7%8E%AF"));
        // Genre goes through `tags`; category1 is pinned to Games (998).
        assert!(url.contains("tags=19"));
        assert!(!url.contains("category1=19"));
        assert!(url.contains("category1=998"));
        assert!(url.contains("sort_by=Price_ASC"));
        assert!(url.contains("specials=1"));
        assert!(url.contains("cc=us"));
        assert!(url.contains("start=30"));
        assert!(url.contains("count=10"));
        assert!(url.contains("l=schinese"));
        assert!(url.contains("infinite=1"));

        let mut params = BrowseParams::default();
        params.term = Some("".into());
        // Empty query is still sent (`query=`) — it means "browse everything".
        assert!(build_browse_url(&params).contains("query=&"));
    }

    #[test]
    fn test_search_results_deserialize() {
        let json = r#"{
            "success": true,
            "total_count": 42,
            "results_html": "<div id=\"search_result_container\"><div class=\"search_result_row ds_collapse_flag \" data-ds-appid=\"1245620\" data-ds-itemkey=\"app_1245620\"><a href=\"https://store.steampowered.com/app/1245620/Elden_Ring/\">…</a></div><div class=\"search_result_row \" data-ds-appid=\"730\">…</div><div class=\"search_result_row\" data-ds-appid=\"999999\">…</div></div>"
        }"#;
        let body: SearchResultsResponse = serde_json::from_str(json).unwrap();
        let ids = extract_app_ids(body.results_html.as_deref().unwrap_or(""));
        assert_eq!(body.total_count, 42);
        assert_eq!(ids, vec![1245620, 730, 999999]);
    }

    #[test]
    fn test_search_results_empty() {
        let json = r#"{
            "success": true,
            "total_count": 0,
            "results_html": "<div id=\"search_result_container\"></div>"
        }"#;
        let body: SearchResultsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(body.total_count, 0);
        assert!(extract_app_ids(body.results_html.as_deref().unwrap_or("")).is_empty());
        assert!(extract_app_ids("").is_empty());
    }

    #[test]
    fn test_featured_deserialize() {
        let json = r#"{
            "status": 1,
            "featured_win": [
                {
                    "id": 1245620,
                    "type": 0,
                    "name": "Elden Ring",
                    "discounted": true,
                    "discount_percent": 50,
                    "original_price": 29800,
                    "final_price": 14900,
                    "currency": "CNY",
                    "large_capsule_image": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/capsule_1920x620.jpg",
                    "small_capsule_image": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/capsule_231x87.jpg",
                    "windows_available": true,
                    "mac_available": true,
                    "linux_available": false,
                    "streamingvideo_available": true,
                    "header_image": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg",
                    "controller_support": "full"
                },
                {
                    "id": 730,
                    "type": 0,
                    "name": "Counter-Strike 2",
                    "discounted": false,
                    "discount_percent": 0,
                    "original_price": 0,
                    "final_price": 0,
                    "currency": "CNY",
                    "windows_available": true,
                    "mac_available": true,
                    "linux_available": true
                },
                {
                    "id": 999,
                    "type": 1,
                    "name": "Some DLC",
                    "final_price": 100
                }
            ],
            "featured_mac": [],
            "featured_linux": [],
            "large_capsules": [
                { "id": 1245620, "type": 0, "name": "Elden Ring", "final_price": 14900 }
            ],
            "layout": 1
        }"#;
        let body: FeaturedResponse = serde_json::from_str(json).unwrap();
        let mut seen = std::collections::HashSet::new();
        let mut items = Vec::new();
        for raw in body
            .featured_win
            .into_iter()
            .chain(body.featured_mac)
            .chain(body.featured_linux)
            .chain(body.large_capsules)
        {
            if raw.r#type != FeaturedType::App || !seen.insert(raw.id) {
                continue;
            }
            items.push(raw.into_browse_item());
        }
        // DLC filtered out; large_capsules duplicate (1245620) dropped.
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].app_id, 1245620);
        assert_eq!(items[0].name, "Elden Ring");
        assert_eq!(items[0].final_price, Some(14900));
        assert_eq!(items[0].initial_price, Some(29800));
        assert_eq!(items[0].discount_percent, Some(50));
        assert_eq!(items[0].currency.as_deref(), Some("CNY"));
        let platforms = items[0].platforms.as_ref().unwrap();
        assert!(platforms.windows);
        assert!(platforms.mac);
        assert!(!platforms.linux);
        // Free titles degrade gracefully.
        assert_eq!(items[1].app_id, 730);
        assert_eq!(items[1].final_price, Some(0));
        // These endpoints don't expose metacritic/release dates.
        assert_eq!(items[0].metacritic_score, None);
        assert_eq!(items[0].release_date, None);
    }

    #[test]
    fn test_featured_type_accepts_string_and_missing() {
        // The API reports `type` as an integer code (0 = app); accept the
        // historical string form and a missing field too.
        let json = r#"{
            "featured_win": [
                { "id": 1, "type": "app", "name": "String type" },
                { "id": 2, "type": 0, "name": "Numeric type" },
                { "id": 3, "name": "No type" },
                { "id": 4, "type": 1, "name": "DLC code" }
            ]
        }"#;
        let body: FeaturedResponse = serde_json::from_str(json).unwrap();
        assert_eq!(body.featured_win[0].r#type, FeaturedType::App);
        assert_eq!(body.featured_win[1].r#type, FeaturedType::App);
        assert_eq!(body.featured_win[2].r#type, FeaturedType::Other);
        assert_eq!(body.featured_win[3].r#type, FeaturedType::Other);
        let apps: Vec<u32> = body
            .featured_win
            .into_iter()
            .filter(|i| i.r#type.is_app())
            .map(|i| i.id)
            .collect();
        assert_eq!(apps, vec![1, 2]);
    }

    #[test]
    fn test_featured_categories_deserialize() {
        let json = r#"{
            "specials": {
                "id": "specials",
                "name": "Special Offers",
                "items": [
                    {
                        "id": 1245620,
                        "type": 0,
                        "name": "Elden Ring",
                        "discounted": true,
                        "discount_percent": 50,
                        "original_price": 29800,
                        "final_price": 14900,
                        "currency": "CNY",
                        "small_capsule_image": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/capsule_231x87.jpg",
                        "windows_available": true,
                        "mac_available": false,
                        "linux_available": false,
                        "discount_expiration": "1 Jan, 2026",
                        "header_image": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg"
                    }
                ],
                "browse": false
            },
            "coming_soon": {
                "id": "coming_soon",
                "name": "Coming Soon",
                "items": [
                    {
                        "id": 271590,
                        "type": 0,
                        "name": "Upcoming Title",
                        "original_price": 9900,
                        "final_price": 9900,
                        "currency": "CNY",
                        "windows_available": true,
                        "mac_available": false,
                        "linux_available": false
                    },
                    {
                        "id": 271590,
                        "type": 0,
                        "name": "Upcoming Title (duplicate)",
                        "final_price": 9900
                    }
                ],
                "browse": true
            },
            "top_sellers": {
                "id": "top_sellers",
                "name": "Top Sellers",
                "items": [],
                "browse": false
            },
            "new_releases": {
                "id": "new_releases",
                "items": [],
                "browse": true
            },
            "genres": [
                { "id": "action", "name": "Action", "items": [1, 2, 3] }
            ],
            "status": 1
        }"#;
        let body: FeaturedCategoriesResponse = serde_json::from_str(json).unwrap();
        let mut rails = Vec::new();
        for category in [
            body.specials,
            body.coming_soon,
            body.top_sellers,
            body.new_releases,
        ]
        .into_iter()
        .flatten()
        {
            if category.items.is_empty() {
                continue;
            }
            // The API can list the same app twice within a rail — dedupe by id.
            let mut seen = std::collections::HashSet::new();
            let items = category
                .items
                .into_iter()
                .filter(|item| seen.insert(item.id))
                .collect();
            rails.push(FeaturedRail {
                id: category.id,
                name: category.name,
                items,
            });
        }
        // Genres skipped; empty top_sellers/new_releases rails dropped.
        assert_eq!(rails.len(), 2);
        assert_eq!(rails[0].id, "specials");
        assert_eq!(rails[0].name.as_deref(), Some("Special Offers"));
        assert_eq!(rails[0].items.len(), 1);
        assert_eq!(rails[0].items[0].id, 1245620);
        assert_eq!(rails[0].items[0].name.as_deref(), Some("Elden Ring"));
        assert_eq!(rails[0].items[0].discount_percent, Some(50));
        assert_eq!(rails[0].items[0].final_price, Some(14900));
        // coming_soon duplicate (271590 twice) collapsed to one.
        assert_eq!(rails[1].id, "coming_soon");
        assert_eq!(rails[1].items.len(), 1);
        assert_eq!(rails[1].items[0].final_price, Some(9900));
    }
}
