use std::path::Path;

use bpi_rs::ids::{Aid, Bvid, Cid};
use bpi_rs::search::{SearchVideoParams, Video as SearchVideo};
use bpi_rs::video::model::{VideoOwner, VideoPage, VideoStat, VideoView};
use bpi_rs::video::params::{
    VideoDescParams, VideoHomepageRecommendationsParams, VideoPageListParams,
    VideoPlayerInfoParams, VideoRelatedParams, VideoViewParams,
};
use bpi_rs::video::recommend::{RcmdItem, RelatedVideo};
use bpi_rs::video_ranking::VideoPopularListParams;
use bpi_rs::{BpiClient, BpiError};
use serde_json::Value;

use super::client;
use super::models::{
    BiliLocalProgress, BiliOwner, BiliVideoCard, BiliVideoDetail, BiliVideoPage, BiliVideoStats,
};

pub async fn search_videos(
    keywords: &str,
    page: Option<u32>,
) -> Result<Vec<BiliVideoCard>, BpiError> {
    let page = page.unwrap_or(1);
    let params = SearchVideoParams::new(keywords)?.with_page(page)?;
    let data = BpiClient::new()?.search().video(params).await?;
    Ok(data
        .result
        .unwrap_or_default()
        .iter()
        .map(search_video_to_card)
        .collect())
}

pub async fn popular_videos(page: Option<u32>) -> Result<Vec<BiliVideoCard>, BpiError> {
    let page = page.unwrap_or(1);
    let params = VideoPopularListParams::new()
        .with_page(page)?
        .with_page_size(30)?;
    let data = BpiClient::new()?
        .video_ranking()
        .popular_list(params)
        .await?;
    Ok(data.list.iter().map(popular_item_to_card).collect())
}

pub async fn recommend_videos(page: Option<u32>) -> Result<Vec<BiliVideoCard>, BpiError> {
    let page = page.unwrap_or(1).max(1);
    let params = VideoHomepageRecommendationsParams::new()
        .page_size(30)?
        .fresh_idx(page)?
        .fetch_row(page)?;
    let data = BpiClient::new()?
        .video()
        .homepage_recommendations(params)
        .await?;
    Ok(data
        .item
        .iter()
        .filter(|item| item.goto == "av" && !item.bvid.trim().is_empty())
        .map(recommend_item_to_card)
        .collect())
}

pub async fn video_detail(
    tool_dir: &Path,
    bvid: Option<String>,
    aid: Option<u64>,
) -> Result<BiliVideoDetail, BpiError> {
    let client = client::optional_account_client(tool_dir)?;
    let view_params = view_params(bvid.as_deref(), aid)?;
    let view = client.video().view(view_params).await?;
    let pages = client
        .video()
        .page_list(page_list_params(Some(view.bvid.as_str()), None)?)
        .await
        .unwrap_or_else(|_| view.pages.clone());

    let description = client
        .video()
        .desc(desc_params(Some(view.bvid.as_str()), None)?)
        .await
        .unwrap_or_default();
    let mut detail = view_to_detail(&view, pages, description);
    let first_cid = detail
        .pages
        .first()
        .map(|page| page.cid)
        .unwrap_or(detail.cid);

    if let Ok(info) = client
        .video()
        .player_info_v2(player_info_params(
            Some(&detail.bvid),
            Some(detail.aid),
            first_cid,
        )?)
        .await
    {
        detail.last_play_cid = positive_i64_to_u64(info.last_play_cid);
        detail.last_play_time = positive_i64_to_u64(info.last_play_time);
    }

    Ok(detail)
}

pub async fn related_videos(
    bvid: Option<String>,
    aid: Option<u64>,
) -> Result<Vec<BiliVideoCard>, BpiError> {
    let params = related_params(bvid.as_deref(), aid)?;
    let data = BpiClient::new()?.video().related_videos(params).await?;
    Ok(data.iter().map(related_video_to_card).collect())
}

pub fn select_initial_page(
    detail: &BiliVideoDetail,
    requested_cid: Option<u64>,
    local_progress: Option<BiliLocalProgress>,
) -> Option<BiliVideoPage> {
    let target_cid = requested_cid
        .filter(|cid| *cid > 0)
        .or(detail.last_play_cid)
        .or_else(|| {
            local_progress
                .map(|progress| progress.cid)
                .filter(|cid| *cid > 0)
        });

    target_cid
        .and_then(|cid| detail.pages.iter().find(|page| page.cid == cid).cloned())
        .or_else(|| detail.pages.first().cloned())
}

pub fn search_video_to_card(video: &SearchVideo) -> BiliVideoCard {
    BiliVideoCard {
        bvid: video.bvid.clone(),
        aid: first_non_zero([video.aid, video.id]),
        cid: 0,
        title: clean_text(&video.title),
        cover: normalize_image_url(&video.pic),
        owner_name: clean_text(&video.author),
        owner_mid: video.mid,
        duration: parse_duration(&video.duration),
        view_count: video.play,
        danmaku_count: video.danmaku,
        published_at: video.pubdate,
        progress: 0,
    }
}

pub fn popular_item_to_card(item: &Value) -> BiliVideoCard {
    value_to_card(item)
}

pub fn ranking_item_to_card(item: &Value) -> BiliVideoCard {
    value_to_card(item)
}

pub fn recommend_item_to_card(item: &RcmdItem) -> BiliVideoCard {
    BiliVideoCard {
        bvid: item.bvid.clone(),
        aid: item.id,
        cid: item.cid,
        title: clean_text(&item.title),
        cover: normalize_image_url(&item.pic),
        owner_name: clean_text(&item.owner.name),
        owner_mid: item.owner.mid,
        duration: item.duration,
        view_count: item.stat.as_ref().map(|stat| stat.view).unwrap_or_default(),
        danmaku_count: item
            .stat
            .as_ref()
            .map(|stat| stat.danmaku)
            .unwrap_or_default(),
        published_at: item.pubdate,
        progress: 0,
    }
}

fn view_to_detail(view: &VideoView, pages: Vec<VideoPage>, description: String) -> BiliVideoDetail {
    BiliVideoDetail {
        bvid: view.bvid.as_str().to_string(),
        aid: view.aid.get(),
        cid: view.cid.get(),
        title: clean_text(&view.title),
        cover: normalize_image_url(&view.pic),
        description,
        owner: owner_to_dto(&view.owner),
        stats: stat_to_dto(&view.stat),
        pages: pages.iter().map(page_to_dto).collect(),
        duration: pages.iter().map(|page| page.duration).sum(),
        published_at: 0,
        last_play_cid: None,
        last_play_time: None,
    }
}

fn desc_params(bvid: Option<&str>, aid: Option<u64>) -> Result<VideoDescParams, BpiError> {
    if let Some(bvid) = bvid.filter(|value| !value.trim().is_empty()) {
        return Ok(VideoDescParams::from_bvid(Bvid::new(bvid.trim())?));
    }
    if let Some(aid) = aid.filter(|value| *value > 0) {
        return Ok(VideoDescParams::from_aid(Aid::new(aid)?));
    }
    Err(BpiError::invalid_parameter(
        "video_id",
        "bvid or aid is required",
    ))
}

fn owner_to_dto(owner: &VideoOwner) -> BiliOwner {
    BiliOwner {
        mid: owner.mid.get(),
        name: clean_text(&owner.name),
        face: normalize_image_url(&owner.face),
    }
}

fn stat_to_dto(stat: &VideoStat) -> BiliVideoStats {
    BiliVideoStats {
        view_count: stat.view,
        danmaku_count: stat.danmaku,
        reply_count: stat.reply,
        favorite_count: stat.favorite.or(stat.fav).unwrap_or_default(),
        coin_count: stat.coin,
        share_count: stat.share,
        like_count: stat.like,
    }
}

fn page_to_dto(page: &VideoPage) -> BiliVideoPage {
    BiliVideoPage {
        cid: page.cid.get(),
        page: page.page,
        title: clean_text(&page.part),
        duration: page.duration,
    }
}

fn related_video_to_card(item: &RelatedVideo) -> BiliVideoCard {
    BiliVideoCard {
        bvid: item.bvid.clone(),
        aid: item.aid,
        cid: item.cid,
        title: clean_text(&item.title),
        cover: normalize_image_url(&item.pic),
        owner_name: clean_text(&item.owner.name),
        owner_mid: item.owner.mid,
        duration: item.duration,
        view_count: item.stat.view,
        danmaku_count: item.stat.danmaku,
        published_at: item.pubdate,
        progress: 0,
    }
}

pub(crate) fn view_params(
    bvid: Option<&str>,
    aid: Option<u64>,
) -> Result<VideoViewParams, BpiError> {
    if let Some(bvid) = bvid.filter(|value| !value.trim().is_empty()) {
        return Ok(VideoViewParams::from_bvid(Bvid::new(bvid.trim())?));
    }
    if let Some(aid) = aid.filter(|value| *value > 0) {
        return Ok(VideoViewParams::from_aid(Aid::new(aid)?));
    }
    Err(BpiError::invalid_parameter(
        "video_id",
        "bvid or aid is required",
    ))
}

pub(crate) fn page_list_params(
    bvid: Option<&str>,
    aid: Option<u64>,
) -> Result<VideoPageListParams, BpiError> {
    if let Some(bvid) = bvid.filter(|value| !value.trim().is_empty()) {
        return Ok(VideoPageListParams::from_bvid(Bvid::new(bvid.trim())?));
    }
    if let Some(aid) = aid.filter(|value| *value > 0) {
        return Ok(VideoPageListParams::from_aid(Aid::new(aid)?));
    }
    Err(BpiError::invalid_parameter(
        "video_id",
        "bvid or aid is required",
    ))
}

pub(crate) fn player_info_params(
    bvid: Option<&str>,
    aid: Option<u64>,
    cid: u64,
) -> Result<VideoPlayerInfoParams, BpiError> {
    let cid = Cid::new(cid)?;
    if let Some(bvid) = bvid.filter(|value| !value.trim().is_empty()) {
        return Ok(VideoPlayerInfoParams::from_bvid(
            Bvid::new(bvid.trim())?,
            cid,
        ));
    }
    if let Some(aid) = aid.filter(|value| *value > 0) {
        return Ok(VideoPlayerInfoParams::from_aid(Aid::new(aid)?, cid));
    }
    Err(BpiError::invalid_parameter(
        "video_id",
        "bvid or aid is required",
    ))
}

pub(crate) fn play_url_params(
    bvid: Option<&str>,
    aid: Option<u64>,
    cid: u64,
    quality: Option<u32>,
    prefer_progressive: bool,
) -> Result<bpi_rs::video::params::VideoPlayUrlParams, BpiError> {
    let cid = Cid::new(cid)?;
    let mut params = if let Some(bvid) = bvid.filter(|value| !value.trim().is_empty()) {
        bpi_rs::video::params::VideoPlayUrlParams::from_bvid(Bvid::new(bvid.trim())?, cid)
    } else if let Some(aid) = aid.filter(|value| *value > 0) {
        bpi_rs::video::params::VideoPlayUrlParams::from_aid(Aid::new(aid)?, cid)
    } else {
        return Err(BpiError::invalid_parameter(
            "video_id",
            "bvid or aid is required",
        ));
    };
    params = if prefer_progressive {
        params.format_flags(0).format_version(0)
    } else {
        params
            .format_flags(16 | 64 | 128)
            .format_version(0)
            .fourk(true)
            .high_quality(true)
    };
    params = params.quality(u64::from(quality.unwrap_or(if prefer_progressive {
        64
    } else {
        127
    })));
    Ok(params)
}

fn related_params(bvid: Option<&str>, aid: Option<u64>) -> Result<VideoRelatedParams, BpiError> {
    if let Some(bvid) = bvid.filter(|value| !value.trim().is_empty()) {
        return Ok(VideoRelatedParams::from_bvid(Bvid::new(bvid.trim())?));
    }
    if let Some(aid) = aid.filter(|value| *value > 0) {
        return Ok(VideoRelatedParams::from_aid(Aid::new(aid)?));
    }
    Err(BpiError::invalid_parameter(
        "video_id",
        "bvid or aid is required",
    ))
}

fn positive_i64_to_u64(value: i64) -> Option<u64> {
    u64::try_from(value).ok().filter(|value| *value > 0)
}

fn value_to_card(item: &Value) -> BiliVideoCard {
    let owner = item.get("owner").unwrap_or(&Value::Null);
    let stat = item.get("stat").unwrap_or(&Value::Null);

    BiliVideoCard {
        bvid: string_field(item, &["bvid"]).unwrap_or_default(),
        aid: u64_field(item, &["aid", "id"]),
        cid: u64_field(item, &["cid"]),
        title: string_field(item, &["title"])
            .map(|title| clean_text(&title))
            .unwrap_or_else(|| "Untitled".to_string()),
        cover: string_field(item, &["pic", "cover", "cover43", "first_frame"])
            .map(|cover| normalize_image_url(&cover))
            .unwrap_or_default(),
        owner_name: string_field(owner, &["name", "uname", "author"])
            .map(|name| clean_text(&name))
            .unwrap_or_default(),
        owner_mid: u64_field(owner, &["mid", "uid"]),
        duration: duration_field(item),
        view_count: u64_field(stat, &["view", "vv"]).max(u64_field(item, &["play", "view"])),
        danmaku_count: u64_field(stat, &["danmaku"]).max(u64_field(item, &["danmaku", "dm"])),
        published_at: u64_field(item, &["pubdate", "pub_time", "ctime"]),
        progress: u64_field(item, &["progress", "view_at"]),
    }
}

fn duration_field(item: &Value) -> u64 {
    item.get("duration")
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_str().map(parse_duration))
        })
        .unwrap_or_default()
}

fn string_field(item: &Value, names: &[&str]) -> Option<String> {
    names.iter().find_map(|name| {
        item.get(*name)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    })
}

fn u64_field(item: &Value, names: &[&str]) -> u64 {
    names
        .iter()
        .find_map(|name| {
            let value = item.get(*name)?;
            value
                .as_u64()
                .or_else(|| value.as_i64().and_then(|number| u64::try_from(number).ok()))
                .or_else(|| value.as_str().and_then(parse_count))
        })
        .unwrap_or_default()
}

fn parse_count(value: &str) -> Option<u64> {
    let normalized = value.trim().replace(',', "");
    normalized.parse::<u64>().ok()
}

fn parse_duration(value: &str) -> u64 {
    let parts: Vec<_> = value.trim().split(':').collect();
    if parts.is_empty() {
        return 0;
    }

    parts
        .iter()
        .rev()
        .enumerate()
        .filter_map(|(index, part)| {
            part.trim()
                .parse::<u64>()
                .ok()
                .map(|value| value * 60_u64.pow(index as u32))
        })
        .sum()
}

fn clean_text(value: &str) -> String {
    value
        .replace("<em class=\"keyword\">", "")
        .replace("</em>", "")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .trim()
        .to_string()
}

pub(crate) fn normalize_image_url(value: &str) -> String {
    let value = value.trim();
    if value.starts_with("//") {
        format!("https:{value}")
    } else {
        value.to_string()
    }
}

fn first_non_zero(values: [u64; 2]) -> u64 {
    values
        .into_iter()
        .find(|value| *value != 0)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn popular_item_mapping_handles_missing_cover_cid_and_owner() {
        let card = popular_item_to_card(&json!({
            "aid": 42,
            "bvid": "BV1xx411c7mD",
            "title": "  <em class=\"keyword\">Rust</em> 入门  ",
            "duration": 93,
            "stat": { "view": 1200, "danmaku": 34 },
            "pubdate": 1700000000
        }));

        assert_eq!(card.bvid, "BV1xx411c7mD");
        assert_eq!(card.aid, 42);
        assert_eq!(card.cid, 0);
        assert_eq!(card.title, "Rust 入门");
        assert_eq!(card.cover, "");
        assert_eq!(card.owner_name, "");
        assert_eq!(card.duration, 93);
        assert_eq!(card.view_count, 1200);
        assert_eq!(card.danmaku_count, 34);
        assert_eq!(card.published_at, 1700000000);
    }

    #[test]
    fn popular_item_mapping_uses_stable_fallbacks() {
        let card = popular_item_to_card(&json!({
            "id": 7,
            "bvid": "BV1yy411c7mD",
            "title": "fallback",
            "cover43": "//i0.hdslb.com/bfs/archive/cover.jpg",
            "owner": { "mid": 99, "name": "UP" },
            "duration": "01:02:03",
            "play": "4321",
            "dm": 56,
            "ctime": 1700000001
        }));

        assert_eq!(card.aid, 7);
        assert_eq!(card.cover, "https://i0.hdslb.com/bfs/archive/cover.jpg");
        assert_eq!(card.owner_mid, 99);
        assert_eq!(card.owner_name, "UP");
        assert_eq!(card.duration, 3723);
        assert_eq!(card.view_count, 4321);
        assert_eq!(card.danmaku_count, 56);
        assert_eq!(card.published_at, 1700000001);
    }

    #[test]
    fn select_initial_page_uses_requested_then_remote_then_local_then_first() {
        let detail = detail_with_pages(Some(30));

        assert_eq!(
            select_initial_page(&detail, Some(20), Some(local_progress(10))).map(|page| page.cid),
            Some(20)
        );
        assert_eq!(
            select_initial_page(&detail, None, Some(local_progress(10))).map(|page| page.cid),
            Some(30)
        );

        let mut no_remote = detail_with_pages(None);
        assert_eq!(
            select_initial_page(&no_remote, Some(999), Some(local_progress(10)))
                .map(|page| page.cid),
            Some(10)
        );
        no_remote.pages.clear();
        assert_eq!(select_initial_page(&no_remote, None, None), None);
    }

    fn detail_with_pages(last_play_cid: Option<u64>) -> BiliVideoDetail {
        BiliVideoDetail {
            bvid: "BV1xx411c7mD".to_string(),
            aid: 42,
            cid: 10,
            title: "test".to_string(),
            cover: String::new(),
            description: String::new(),
            owner: BiliOwner {
                mid: 1,
                name: "UP".to_string(),
                face: String::new(),
            },
            stats: BiliVideoStats {
                view_count: 0,
                danmaku_count: 0,
                reply_count: 0,
                favorite_count: 0,
                coin_count: 0,
                share_count: 0,
                like_count: 0,
            },
            pages: vec![
                BiliVideoPage {
                    cid: 10,
                    page: 1,
                    title: "P1".to_string(),
                    duration: 60,
                },
                BiliVideoPage {
                    cid: 20,
                    page: 2,
                    title: "P2".to_string(),
                    duration: 70,
                },
                BiliVideoPage {
                    cid: 30,
                    page: 3,
                    title: "P3".to_string(),
                    duration: 80,
                },
            ],
            duration: 210,
            published_at: 0,
            last_play_cid,
            last_play_time: Some(15),
        }
    }

    fn local_progress(cid: u64) -> BiliLocalProgress {
        BiliLocalProgress {
            bvid: "BV1xx411c7mD".to_string(),
            aid: 42,
            cid,
            progress_seconds: 9,
            updated_at: 100,
        }
    }
}
