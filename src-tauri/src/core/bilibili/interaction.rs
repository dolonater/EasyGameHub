use std::path::Path;

use bpi_rs::ids::Mid;
use bpi_rs::user::{RelationAction, RelationSource, UserCardParams, UserModifyRelationParams};
use bpi_rs::video::{VideoCoinParams, VideoCoinStatusParams, VideoLikeParams, VideoRelationParams};
use bpi_rs::{BpiClient, BpiError};

use super::account;
use super::client;
use super::library;
use super::models::{
    BiliFavoriteFolder, BiliOperationResult, BiliOwnerInteractionState, BiliVideoInteractionState,
    BiliVideoInteractionStats,
};
use super::video;

pub async fn interaction_state(
    tool_dir: &Path,
    bvid: Option<String>,
    aid: Option<u64>,
    owner_mid: Option<u64>,
) -> Result<BiliVideoInteractionState, BpiError> {
    let detail = video::video_detail(tool_dir, bvid, aid).await?;
    let current_mid = current_mid_optional(tool_dir)?;
    let client = client::optional_account_client(tool_dir)?;
    let owner_mid = owner_mid
        .filter(|value| *value > 0)
        .unwrap_or(detail.owner.mid);

    let favorite_folders = if current_mid.is_some() {
        library::favorite_folders(&client, current_mid.unwrap_or_default(), Some(detail.aid))
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let to_view = if current_mid.is_some() {
        library::toview_list(&client)
            .await
            .map(|items| items.iter().any(|item| item.video.aid == detail.aid))
            .unwrap_or(false)
    } else {
        false
    };
    let coin_count = if current_mid.is_some() {
        client
            .video()
            .coin_status(VideoCoinStatusParams::from_ids(
                Some(detail.aid),
                Some(detail.bvid.clone()),
            )?)
            .await
            .map(|data| data.multiply)
            .unwrap_or_default()
    } else {
        0
    };
    let relation = if current_mid.is_some() {
        client
            .video()
            .relation(VideoRelationParams::from_ids(
                Some(detail.aid),
                Some(detail.bvid.clone()),
            )?)
            .await
            .ok()
    } else {
        None
    };
    let owner = owner_state(&client, owner_mid, &detail.owner.name, &detail.owner.face).await;

    Ok(BiliVideoInteractionState {
        aid: detail.aid,
        bvid: detail.bvid,
        liked: relation.as_ref().is_some_and(|data| data.like),
        coin_count,
        favorited: is_favorited(&favorite_folders)
            || relation.as_ref().is_some_and(|data| data.favorite),
        to_view,
        stats: BiliVideoInteractionStats {
            like_count: detail.stats.like_count,
            coin_count: detail.stats.coin_count,
            favorite_count: detail.stats.favorite_count,
            share_count: detail.stats.share_count,
        },
        owner,
        favorite_folders,
    })
}

pub async fn like_video(
    tool_dir: &Path,
    bvid: Option<String>,
    aid: Option<u64>,
    liked: bool,
) -> Result<BiliVideoInteractionState, BpiError> {
    let client = client::account_client(tool_dir)?;
    client
        .video()
        .like(VideoLikeParams::from_ids(
            aid,
            bvid.clone(),
            if liked { 1 } else { 2 },
        )?)
        .await?;
    let mut state = interaction_state(tool_dir, bvid, aid, None).await?;
    state.liked = liked;
    Ok(state)
}

pub async fn coin_video(
    tool_dir: &Path,
    bvid: Option<String>,
    aid: Option<u64>,
    multiply: u8,
    also_like: bool,
) -> Result<BiliVideoInteractionState, BpiError> {
    let client = client::account_client(tool_dir)?;
    let params = VideoCoinParams::from_ids(aid, bvid.clone(), multiply)?.select_like(also_like);
    client.video().coin(params).await?;
    let mut state = interaction_state(tool_dir, bvid, aid, None).await?;
    state.coin_count = state.coin_count.max(multiply);
    if also_like {
        state.liked = true;
    }
    Ok(state)
}

pub async fn favorite_video_interaction(
    tool_dir: &Path,
    rid: u64,
    add_media_ids: Vec<String>,
    del_media_ids: Vec<String>,
) -> Result<BiliVideoInteractionState, BpiError> {
    let client = client::account_client(tool_dir)?;
    library::favorite_video(&client, rid, add_media_ids, del_media_ids).await?;
    interaction_state(tool_dir, None, Some(rid), None).await
}

pub async fn toview_video_interaction(
    tool_dir: &Path,
    aid: u64,
    bvid: Option<String>,
    to_view: bool,
) -> Result<BiliVideoInteractionState, BpiError> {
    let client = client::account_client(tool_dir)?;
    if to_view {
        library::add_toview(&client, aid, bvid.clone()).await?;
    } else {
        library::remove_toview(&client, aid).await?;
    }
    let mut state = interaction_state(tool_dir, bvid, Some(aid), None).await?;
    state.to_view = to_view;
    Ok(state)
}

pub async fn follow_owner(
    tool_dir: &Path,
    mid: u64,
    following: bool,
    bvid: Option<String>,
    aid: Option<u64>,
) -> Result<BiliVideoInteractionState, BpiError> {
    let client = client::account_client(tool_dir)?;
    let action = if following {
        RelationAction::Follow
    } else {
        RelationAction::Unfollow
    };
    let params = UserModifyRelationParams::new(mid, action)?.source(RelationSource::Video);
    client.user().modify_relation(params).await?;
    let mut state = interaction_state(tool_dir, bvid, aid, Some(mid)).await?;
    state.owner.following = following;
    Ok(state)
}

pub fn share_link(bvid: &str) -> Result<String, BpiError> {
    let bvid = normalize_bvid(bvid)?;
    Ok(format!("https://www.bilibili.com/video/{bvid}/"))
}

pub fn copy_share_link(bvid: &str) -> Result<BiliOperationResult, BpiError> {
    let _ = share_link(bvid)?;
    Ok(BiliOperationResult::ok("share link ready"))
}

fn current_mid_optional(tool_dir: &Path) -> Result<Option<u64>, BpiError> {
    let Some(cookie) = account::load_cookie(tool_dir)? else {
        return Ok(None);
    };
    let Some(account) = account::cookie_to_account(&cookie) else {
        return Ok(None);
    };
    Ok(account
        .dede_user_id
        .parse::<u64>()
        .ok()
        .filter(|mid| *mid > 0))
}

async fn owner_state(
    client: &BpiClient,
    mid: u64,
    fallback_name: &str,
    fallback_avatar: &str,
) -> BiliOwnerInteractionState {
    if let Ok(card) = Mid::new(mid).map(UserCardParams::new) {
        if let Ok(profile) = client.user().card(card).await {
            return BiliOwnerInteractionState {
                mid: profile.card.mid.get(),
                name: profile.card.name,
                avatar: video::normalize_image_url(&profile.card.face),
                follower_count: profile.follower.max(profile.card.fans),
                following: profile.following,
            };
        }
    }

    BiliOwnerInteractionState {
        mid,
        name: fallback_name.to_string(),
        avatar: fallback_avatar.to_string(),
        follower_count: 0,
        following: false,
    }
}

fn is_favorited(folders: &[BiliFavoriteFolder]) -> bool {
    folders
        .iter()
        .any(|folder| folder.owned && folder.fav_state > 0)
}

fn normalize_bvid(value: &str) -> Result<String, BpiError> {
    let bvid = value.trim();
    if bvid.is_empty() || !bvid.chars().all(|ch| ch.is_ascii_alphanumeric()) {
        return Err(BpiError::invalid_parameter(
            "bvid",
            "value must be a Bilibili video id",
        ));
    }
    Ok(bvid.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn favorite_state_uses_owned_active_folders_only() {
        assert!(is_favorited(&[BiliFavoriteFolder {
            id: 1,
            title: "默认收藏夹".to_string(),
            cover: String::new(),
            owner_mid: 42,
            owner_name: String::new(),
            media_count: 1,
            owned: true,
            fav_state: 1,
        }]));
        assert!(!is_favorited(&[BiliFavoriteFolder {
            id: 2,
            title: "别人的收藏夹".to_string(),
            cover: String::new(),
            owner_mid: 7,
            owner_name: String::new(),
            media_count: 1,
            owned: false,
            fav_state: 1,
        }]));
    }

    #[test]
    fn share_link_rejects_invalid_bvid() {
        assert!(share_link("../BV1").is_err());
        assert_eq!(
            share_link("BV1xx411c7mD").unwrap(),
            "https://www.bilibili.com/video/BV1xx411c7mD/"
        );
    }
}
