//! Bilibili 搜索增强（P1：输入联想 suggest、热搜 hotwords）。
//!
//! 均为匿名公开接口；空关键词的 suggest 直接返回空数组，不触发 bpi-rs 参数校验。

use bpi_rs::search::suggest::{SearchSuggestItem, SearchSuggestParams};
use bpi_rs::{BpiClient, BpiError};

use super::models::BiliHotWord;

/// 搜索输入联想。
pub async fn suggest(keyword: &str) -> Result<Vec<String>, BpiError> {
    let keyword = keyword.trim();
    if keyword.is_empty() {
        return Ok(Vec::new());
    }
    let params = SearchSuggestParams::new(keyword)?;
    let data = BpiClient::new()?.search().suggest(params).await?;
    Ok(data
        .tag
        .unwrap_or_default()
        .iter()
        .filter_map(suggest_item_text)
        .collect())
}

/// 热搜榜。
pub async fn hotwords() -> Result<Vec<BiliHotWord>, BpiError> {
    let data = BpiClient::new()?.search().hotwords().await?;
    Ok(data
        .list
        .iter()
        .map(|item| BiliHotWord {
            keyword: item.keyword.clone(),
            show_name: item.show_name.clone(),
            heat_score: item.heat_score,
        })
        .collect())
}

fn suggest_item_text(item: &SearchSuggestItem) -> Option<String> {
    item.name
        .clone()
        .filter(|name| !name.trim().is_empty())
        .or_else(|| item.value.clone())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}
