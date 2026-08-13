//! Steam store browsing commands (storefront rails + filtered browse grid).

use crate::commands::steam_api::shared_client;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use steam_sdk::client::store::{
    AppDetail, BrowseItem, BrowseParams, BrowseSort, FeaturedItem, Platforms,
};

const CACHE_TTL: Duration = Duration::from_secs(600);
const DEFAULT_COUNT: u32 = 15;
const MAX_COUNT: u32 = 50;

// ── DTOs ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowseItemDto {
    pub app_id: u32,
    pub name: String,
    pub tiny_image: Option<String>,
    /// Base-unit price (cents for decimal currencies), if any.
    pub final_price: Option<u64>,
    pub initial_price: Option<u64>,
    pub discount_percent: Option<u32>,
    pub currency: Option<String>,
    pub release_date: Option<String>,
    pub platforms: Option<PlatformsDto>,
    pub metacritic_score: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformsDto {
    pub windows: bool,
    pub mac: bool,
    pub linux: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowseResultDto {
    /// Total matching titles across all pages.
    pub total: u32,
    pub items: Vec<BrowseItemDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeaturedRailDto {
    pub id: String,
    pub name: Option<String>,
    pub items: Vec<BrowseItemDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreHomeDto {
    pub featured: Vec<BrowseItemDto>,
    pub rails: Vec<FeaturedRailDto>,
}

// ── In-memory cache (TTL, no file cache) ────────────────────

struct Cached<T> {
    fetched_at: Instant,
    data: T,
}

static BROWSE_CACHE: OnceLock<Mutex<HashMap<String, Cached<BrowseResultDto>>>> = OnceLock::new();
static HOME_CACHE: OnceLock<Mutex<HashMap<String, Cached<StoreHomeDto>>>> = OnceLock::new();

fn browse_cache() -> &'static Mutex<HashMap<String, Cached<BrowseResultDto>>> {
    BROWSE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn home_cache() -> &'static Mutex<HashMap<String, Cached<StoreHomeDto>>> {
    HOME_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

// ── Mapping helpers ─────────────────────────────────────────

fn platforms_dto(p: &Platforms) -> PlatformsDto {
    PlatformsDto {
        windows: p.windows,
        mac: p.mac,
        linux: p.linux,
    }
}

fn browse_item_dto(item: &BrowseItem) -> BrowseItemDto {
    BrowseItemDto {
        app_id: item.app_id,
        name: item.name.clone(),
        tiny_image: item.tiny_image.clone(),
        final_price: item.final_price,
        initial_price: item.initial_price,
        discount_percent: item.discount_percent,
        currency: item.currency.clone(),
        release_date: item.release_date.clone(),
        platforms: item.platforms.as_ref().map(platforms_dto),
        metacritic_score: item.metacritic_score,
    }
}

fn browse_item_from_featured(item: &FeaturedItem) -> BrowseItemDto {
    BrowseItemDto {
        app_id: item.id,
        name: item.name.clone().unwrap_or_default(),
        tiny_image: item
            .small_capsule_image
            .clone()
            .or_else(|| item.header_image.clone()),
        final_price: item.final_price,
        initial_price: item.original_price,
        discount_percent: item.discount_percent,
        currency: item.currency.clone(),
        release_date: None,
        platforms: Some(PlatformsDto {
            windows: item.windows_available,
            mac: item.mac_available,
            linux: item.linux_available,
        }),
        metacritic_score: None,
    }
}

fn browse_item_from_detail(detail: &AppDetail) -> BrowseItemDto {
    BrowseItemDto {
        app_id: detail.app_id,
        name: detail.name.clone().unwrap_or_default(),
        tiny_image: detail.header_image.clone(),
        final_price: detail.price.as_ref().map(|p| p.final_price),
        initial_price: detail.price.as_ref().map(|p| p.initial_price),
        discount_percent: detail.price.as_ref().map(|p| p.discount_percent),
        currency: detail.price.as_ref().map(|p| p.currency.clone()),
        release_date: detail.release_date.clone(),
        platforms: detail.platforms.as_ref().map(platforms_dto),
        metacritic_score: detail.metacritic.as_ref().map(|m| m.score as u32),
    }
}

fn parse_sort(sort: Option<&str>) -> BrowseSort {
    match sort {
        Some("Price_ASC") => BrowseSort::PriceAsc,
        Some("Price_DESC") => BrowseSort::PriceDesc,
        Some("Reviews_DESC") => BrowseSort::ReviewsDesc,
        Some("Released_DESC") => BrowseSort::ReleasedDesc,
        // Unknown values fall back to relevance (store default).
        _ => BrowseSort::Relevance,
    }
}

// ── Commands ────────────────────────────────────────────────

/// Browse the store with filters (genre, sort, discounts, region) and
/// pagination. Pinned to `l=schinese`; `cc` defaults to `cn`.
///
/// Uses the store search page JSON endpoint (`/search/results/`) because
/// `/api/storesearch` ignores category/sort/discount filters; the returned
/// app ids are resolved to full details via batched `appdetails`.
#[tauri::command]
pub async fn browse_steam_games(
    term: Option<String>,
    category: Option<u32>,
    sort: Option<String>,
    specials: bool,
    cc: Option<String>,
    start: Option<u32>,
    count: Option<u32>,
) -> Result<BrowseResultDto, String> {
    let sort = parse_sort(sort.as_deref());
    let cc = cc.unwrap_or_else(|| "cn".into());
    let start = start.unwrap_or(0);
    let count = count.unwrap_or(DEFAULT_COUNT).clamp(1, MAX_COUNT);

    let key = format!(
        "browse|{}|{}|{}|{}|{}|{}|{}",
        term.as_deref().unwrap_or(""),
        category.map(|c| c.to_string()).unwrap_or_default(),
        sort.as_param(),
        specials,
        cc,
        start,
        count
    );
    if let Some(hit) = browse_cache().lock().unwrap().get(&key) {
        if hit.fetched_at.elapsed() < CACHE_TTL {
            return Ok(hit.data.clone());
        }
    }

    let params = BrowseParams {
        term,
        category,
        sort,
        specials,
        cc: cc.clone(),
        start,
        count,
    };
    let client = shared_client();
    let (total, app_ids) = steam_sdk::client::store::search_results_page(&client, &params)
        .map_err(|e| e.to_string())?;
    let details =
        steam_sdk::client::store::get_app_details_in_region(&client, &app_ids, "schinese", &cc)
            .map_err(|e| e.to_string())?;
    let dto = BrowseResultDto {
        total,
        items: details.iter().map(browse_item_from_detail).collect(),
    };
    browse_cache().lock().unwrap().insert(
        key,
        Cached {
            fetched_at: Instant::now(),
            data: dto.clone(),
        },
    );
    Ok(dto)
}

/// Storefront home: the featured rail plus curated rails (specials / coming
/// soon / top sellers / new releases). Both endpoints return full item
/// entries, so no separate detail lookups are needed.
#[tauri::command]
pub async fn get_store_home(cc: Option<String>) -> Result<StoreHomeDto, String> {
    let cc = cc.unwrap_or_else(|| "cn".into());

    let key = format!("home|{}", cc);
    if let Some(hit) = home_cache().lock().unwrap().get(&key) {
        if hit.fetched_at.elapsed() < CACHE_TTL {
            return Ok(hit.data.clone());
        }
    }

    let client = shared_client();
    let featured =
        steam_sdk::client::store::featured(&client, &cc, "schinese").map_err(|e| e.to_string())?;
    let rails_raw = steam_sdk::client::store::featured_categories(&client, &cc, "schinese")
        .map_err(|e| e.to_string())?;

    let rails = rails_raw
        .into_iter()
        .map(|rail| FeaturedRailDto {
            id: rail.id,
            name: rail.name,
            items: rail.items.iter().map(browse_item_from_featured).collect(),
        })
        .collect();

    let dto = StoreHomeDto {
        featured: featured.iter().map(browse_item_dto).collect(),
        rails,
    };
    home_cache().lock().unwrap().insert(
        key,
        Cached {
            fetched_at: Instant::now(),
            data: dto.clone(),
        },
    );
    Ok(dto)
}
