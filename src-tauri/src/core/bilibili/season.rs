//! Bilibili 番剧（P2：详情 + 分集 + 追番/取消追番 + 番剧播放源）。

use bpi_rs::bangumi::params::BangumiVideoStreamParams;
use bpi_rs::bangumi::BangumiFollowParams;
use bpi_rs::ids::{EpisodeId, SeasonId};
use bpi_rs::models::Fnval;

use super::client;
use super::models::{
    BiliBangumiFollow, BiliPgcCard, BiliPgcIndexPage, BiliPgcSection, BiliSeasonDetail,
    BiliSeasonEpisode, BiliSeasonScore,
};
use super::playback;

/// 追番/影视页聚合数据（modules 分区行）。
pub async fn pgc_tabs(
    tool_dir: &std::path::Path,
    kind: PgcTabKind,
) -> Result<Vec<BiliPgcSection>, bpi_rs::BpiError> {
    let client = client::optional_account_client(tool_dir)?;
    let data = match kind {
        PgcTabKind::Bangumi => client.bangumi().bangumi_tab().await?,
        PgcTabKind::Cinema => client.bangumi().cinema_tab().await?,
    };
    Ok(data
        .modules
        .iter()
        .map(|module| BiliPgcSection {
            title: module.title.clone(),
            style: module.style.clone(),
            items: module.items.iter().map(pgc_item_to_card).collect(),
        })
        .collect())
}

/// PGC 全量列表（season index：排序/连载筛选/分页）。
pub async fn pgc_index(
    tool_dir: &std::path::Path,
    season_type: u32,
    order: u32,
    is_finish: i32,
    page: Option<u32>,
) -> Result<BiliPgcIndexPage, bpi_rs::BpiError> {
    let params = bpi_rs::bangumi::index::PgcIndexParams::new(season_type)?
        .order(order)
        .is_finish(is_finish)
        .page(page.unwrap_or(1))?;
    let data = client::optional_account_client(tool_dir)?
        .bangumi()
        .season_index(params)
        .await?;
    Ok(BiliPgcIndexPage {
        items: data
            .list
            .into_iter()
            .map(|item| BiliPgcCard {
                season_id: item.season_id,
                season_type: item.season_type,
                title: item.title,
                cover: item.cover,
                index_show: item.index_show,
                score: item.score.and_then(|score| score.score.parse().ok()),
            })
            .collect(),
        has_more: data.has_next,
    })
}

/// PGC 排行榜（番剧 1/电影 2/纪录片 3/国创 4/电视剧 5/综艺 7 分榜）。
pub async fn pgc_rank(
    tool_dir: &std::path::Path,
    season_type: u32,
) -> Result<Vec<BiliPgcCard>, bpi_rs::BpiError> {
    let params = bpi_rs::bangumi::tab::PgcRankParams::new(season_type)?;
    let data = client::optional_account_client(tool_dir)?
        .bangumi()
        .season_rank(params)
        .await?;
    Ok(data.list.iter().map(pgc_rank_item_to_card).collect())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PgcTabKind {
    Bangumi,
    Cinema,
}

fn pgc_item_to_card(item: &bpi_rs::bangumi::tab::PgcItem) -> BiliPgcCard {
    BiliPgcCard {
        season_id: item.season_id,
        season_type: item.season_type,
        title: item.title.clone(),
        cover: item.cover.clone(),
        index_show: item
            .new_ep
            .as_ref()
            .map(|ep| ep.index_show.clone())
            .unwrap_or_default(),
        score: item
            .score
            .as_ref()
            .and_then(|score| score.score.parse().ok()),
    }
}

fn pgc_rank_item_to_card(item: &bpi_rs::bangumi::tab::PgcRankItem) -> BiliPgcCard {
    BiliPgcCard {
        season_id: item.season_id,
        season_type: item.season_type,
        title: item.title.clone(),
        cover: item.cover.clone(),
        index_show: item
            .new_ep
            .as_ref()
            .map(|ep| ep.index_show.clone())
            .unwrap_or_default(),
        score: item
            .score
            .as_ref()
            .and_then(|score| score.score.parse().ok()),
    }
}

/// 番剧详情（含分集列表与追番态）。
pub async fn season_detail(
    tool_dir: &std::path::Path,
    season_id: u64,
) -> Result<BiliSeasonDetail, bpi_rs::BpiError> {
    let client = client::optional_account_client(tool_dir)?;
    let detail = client
        .bangumi()
        .detail_by_season_id(SeasonId::new(season_id)?)
        .await?;
    let score = detail.rating.map(|rating| BiliSeasonScore {
        score: rating.score,
        count: rating.count,
    });
    let is_followed = detail
        .user_status
        .as_ref()
        .map(|status| status.follow > 0)
        .unwrap_or(false);
    let episodes = detail
        .episodes
        .iter()
        .map(|episode| BiliSeasonEpisode {
            ep_id: episode.ep_id,
            aid: episode.aid,
            cid: episode.cid,
            bvid: episode.bvid.clone(),
            title: episode.title.clone(),
            long_title: episode.long_title.clone(),
            cover: episode.cover.clone(),
            duration: episode.duration,
        })
        .collect();
    Ok(BiliSeasonDetail {
        season_id: detail.season_id,
        media_id: detail.media_id,
        title: detail.season_title,
        cover: detail.cover,
        evaluate: detail.evaluate,
        total: detail.total,
        is_followed,
        new_ep: detail.new_ep.title,
        score,
        episodes,
    })
}

/// 我的追番列表（分页，kind: bangumi=番剧 / cinema=影视）。
pub async fn bangumi_follow_list(
    tool_dir: &std::path::Path,
    mid: u64,
    page: Option<u32>,
    cinema: bool,
) -> Result<Vec<BiliBangumiFollow>, bpi_rs::BpiError> {
    use bpi_rs::ids::Mid;
    use bpi_rs::user::params::{UserBangumiFollowKind, UserBangumiFollowListParams};

    let mut params = UserBangumiFollowListParams::new(Mid::new(mid)?);
    if cinema {
        params = params.with_kind(UserBangumiFollowKind::Cinema);
    }
    if let Some(page) = page {
        params = params.with_page(page);
    }
    let data = client::account_client(tool_dir)?
        .user()
        .bangumi_follow_list(params)
        .await?;
    Ok(data
        .items
        .iter()
        .map(|item| BiliBangumiFollow {
            season_id: item.season_id,
            media_id: item.media_id,
            title: item.title.clone(),
            cover: item.cover.clone(),
            total_count: item.total_count,
            is_finish: item.is_finish,
            badge: item.badge.clone(),
        })
        .collect())
}

/// 追番 / 取消追番。
pub async fn season_follow(
    tool_dir: &std::path::Path,
    season_id: u64,
    follow: bool,
) -> Result<(), bpi_rs::BpiError> {
    let client = client::account_client(tool_dir)?;
    let params = BangumiFollowParams::new(SeasonId::new(season_id)?);
    if follow {
        client.bangumi().follow(params).await?;
    } else {
        client.bangumi().unfollow(params).await?;
    }
    Ok(())
}

/// 番剧单集播放源：ep 的 aid/cid/bvid 由前端从详情分集传入，
/// 复用会话/MPD/代理基建（`create_session_from_bangumi_stream` 做字段级转换）。
pub async fn season_ep_playback(
    tool_dir: &std::path::Path,
    ep_id: u64,
    aid: u64,
    cid: u64,
    bvid: String,
    proxy_port: u16,
    prefer_direct: bool,
    preferences: playback::PlaybackPreferences,
) -> Result<
    (
        playback::PlaybackSession,
        crate::core::bilibili::models::BiliPlaybackSource,
    ),
    bpi_rs::BpiError,
> {
    let client = client::optional_account_client(tool_dir)?;
    let mut params = BangumiVideoStreamParams::from_episode_id(EpisodeId::new(ep_id)?);
    params =
        params.with_fnval(Fnval::DASH | Fnval::FOURK | Fnval::EIGHTK | Fnval::HDR | Fnval::AV1);
    let data = client.bangumi().video_stream(params).await?;
    playback::create_session_from_bangumi_stream(
        &data,
        bvid,
        aid,
        cid,
        proxy_port,
        prefer_direct,
        preferences,
    )
}
