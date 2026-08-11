//! Bilibili 排行榜 / 每周必看 / 入站必刷（P1：视频榜 rid 分区；PGC 榜随 P2 pgc 接口）。
//!
//! 全部为匿名公开接口，走 `BpiClient::new()`（与现有 search_videos/popular_videos 一致）。

use bpi_rs::video_ranking::params::{PopularSeriesOneParams, VideoRankingListParams};
use bpi_rs::{BpiClient, BpiError};

use super::models::{BiliPreciousVideos, BiliVideoCard, BiliWeeklySeries};
use super::video::{ranking_item_to_card, value_to_card};

/// 分区视频排行榜。`ranking/v2` 单次返回 100 条，无分页参数。
pub async fn ranking_videos(rid: Option<u32>) -> Result<Vec<BiliVideoCard>, BpiError> {
    let mut params = VideoRankingListParams::new();
    if let Some(rid) = rid {
        params = params.with_rid(rid)?;
    }
    let data = BpiClient::new()?
        .video_ranking()
        .ranking_list(params)
        .await?;
    Ok(data
        .list
        .iter()
        .map(|item| ranking_item_to_card(&item.inner))
        .collect())
}

/// 每周必看期列表。
pub async fn weekly_series_list() -> Result<Vec<BiliWeeklySeries>, BpiError> {
    let data = BpiClient::new()?
        .video_ranking()
        .popular_series_list()
        .await?;
    Ok(data
        .list
        .iter()
        .map(|item| BiliWeeklySeries {
            number: item.number,
            subject: item.subject.clone(),
            name: item.name.clone(),
        })
        .collect())
}

/// 每周必看单期视频列表（按期数查询）。
pub async fn weekly_series_one(number: u32) -> Result<Vec<BiliVideoCard>, BpiError> {
    let params = PopularSeriesOneParams::new(number)?;
    let data = BpiClient::new()?
        .video_ranking()
        .popular_series_one(params)
        .await?;
    Ok(data.list.iter().map(value_to_card).collect())
}

/// 入站必刷（精选必看）。
pub async fn precious_videos() -> Result<BiliPreciousVideos, BpiError> {
    let data = BpiClient::new()?.video_ranking().popular_precious().await?;
    Ok(BiliPreciousVideos {
        title: data.title,
        explain: data.explain,
        videos: data.list.iter().map(value_to_card).collect(),
    })
}
