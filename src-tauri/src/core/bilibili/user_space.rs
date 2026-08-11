//! Bilibili UP 主页（P1：信息卡 + 投稿视频 + 关注/取关）。
//!
//! space_info / card / up_stat 逐项容错：任一失败只降级对应字段，不整卡失败。

use bpi_rs::ids::Mid;
use bpi_rs::user::params::{
    UserCardParams, UserSpaceParams, UserUpStatParams, UserUploadedVideosParams,
};
use bpi_rs::user::relation::{RelationAction, UserModifyRelationParams};
use bpi_rs::{BpiClient, BpiError};

use super::client;
use super::models::{BiliUserSpace, BiliUserSpaceLive, BiliVideoCard};
use super::video::parse_duration;

/// UP 主页聚合信息。
pub async fn user_space(tool_dir: &std::path::Path, mid: u64) -> Result<BiliUserSpace, BpiError> {
    let mid = Mid::new(mid)?;
    let client = client::optional_account_client(tool_dir)?;

    let space = client.user().space_info(UserSpaceParams::new(mid)).await?;
    let card = client.user().card(UserCardParams::new(mid)).await.ok();
    let up_stat = client.user().up_stat(UserUpStatParams::new(mid)).await.ok();

    let live_room = space.live_room.as_ref().map(|room| BiliUserSpaceLive {
        room_id: room.room_id,
        live_status: room.live_status,
        title: room.title.clone(),
        url: room.url.clone(),
    });

    Ok(BiliUserSpace {
        mid: space.mid.get(),
        name: space.name.clone(),
        face: space.face.clone(),
        sign: space.sign.clone(),
        level: space.level as u32,
        fans: card.as_ref().map(|card| card.follower).unwrap_or(0),
        following: card.as_ref().map(|card| card.card.attention).unwrap_or(0),
        likes: up_stat.as_ref().map(|stat| stat.likes).unwrap_or(0),
        view: up_stat.as_ref().map(|stat| stat.archive.view).unwrap_or(0),
        archive_count: card.as_ref().map(|card| card.archive_count).unwrap_or(0),
        is_followed: space.is_followed,
        live_room,
    })
}

/// UP 投稿视频列表（分页）。
pub async fn user_videos(
    tool_dir: &std::path::Path,
    mid: u64,
    page: Option<u32>,
) -> Result<Vec<BiliVideoCard>, BpiError> {
    let mid = Mid::new(mid)?;
    let page = page.unwrap_or(1);
    let params = UserUploadedVideosParams::new(mid).with_page(page)?;
    let data = client::optional_account_client(tool_dir)?
        .user()
        .uploaded_videos(params)
        .await?;
    Ok(data.list.videos.iter().map(uploaded_to_card).collect())
}

/// 关注 / 取关 UP。
pub async fn user_follow(
    tool_dir: &std::path::Path,
    mid: u64,
    follow: bool,
) -> Result<(), BpiError> {
    let action = if follow {
        RelationAction::Follow
    } else {
        RelationAction::Unfollow
    };
    let params = UserModifyRelationParams::new(mid, action)?;
    client::account_client(tool_dir)?
        .user()
        .modify_relation(params)
        .await?;
    Ok(())
}

fn uploaded_to_card(item: &bpi_rs::user::model::UserUploadedVideo) -> BiliVideoCard {
    BiliVideoCard {
        bvid: item.bvid.to_string(),
        aid: item.aid.get(),
        cid: 0,
        title: item.title.clone(),
        cover: item.pic.clone(),
        owner_name: item.author.clone(),
        owner_mid: item.mid.get(),
        duration: parse_duration(&item.length),
        view_count: item.play,
        danmaku_count: 0,
        published_at: item.created,
        progress: 0,
    }
}
