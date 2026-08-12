use bpi_rs::fav::info::{CollectedFolderItem, CreatedFolderItem};
use bpi_rs::fav::list::FavListMedia;
use bpi_rs::fav::{FavCollectedListParams, FavCreatedListParams, FavListDetailParams};
use bpi_rs::historytoview::history::HistoryListItem;
use bpi_rs::historytoview::params::{
    HistoryListParams, HistoryListType, ToViewAddParams, ToViewDeleteParams,
};
use bpi_rs::historytoview::toview::ToViewVideoItem;
use bpi_rs::ids::{MediaId, Mid};
use bpi_rs::video::VideoFavoriteParams;
use bpi_rs::{BpiClient, BpiError};

use super::models::{
    BiliFavoriteFolder, BiliFavoriteItem, BiliFavoritePage, BiliHistoryItem, BiliOperationResult,
    BiliToViewItem, BiliVideoCard,
};
use super::video;

const LIBRARY_PAGE_SIZE: u32 = 24;

pub async fn history_list(
    client: &BpiClient,
    page: Option<u32>,
) -> Result<Vec<BiliHistoryItem>, BpiError> {
    let _ = page;
    let params = HistoryListParams::new()
        .with_type(HistoryListType::Archive)
        .with_page_size(LIBRARY_PAGE_SIZE)?;
    let data = client.historytoview().history_list(params).await?;
    Ok(data.list.iter().filter_map(history_item_to_dto).collect())
}

pub async fn toview_list(client: &BpiClient) -> Result<Vec<BiliToViewItem>, BpiError> {
    let data = client.historytoview().toview_list().await?;
    Ok(data.list.iter().map(toview_item_to_dto).collect())
}

pub async fn add_toview(
    client: &BpiClient,
    aid: u64,
    bvid: Option<String>,
) -> Result<BiliOperationResult, BpiError> {
    let params = ToViewAddParams::new(non_zero(aid), bvid)?;
    client.historytoview().add_toview(params).await?;
    Ok(BiliOperationResult::ok("toview added"))
}

pub async fn remove_toview(client: &BpiClient, aid: u64) -> Result<BiliOperationResult, BpiError> {
    let params = ToViewDeleteParams::new(non_zero(aid), None)?;
    client.historytoview().delete_toview(params).await?;
    Ok(BiliOperationResult::ok("toview removed"))
}

pub async fn favorite_folders(
    client: &BpiClient,
    mid: u64,
    rid: Option<u64>,
) -> Result<Vec<BiliFavoriteFolder>, BpiError> {
    let mid = Mid::new(mid)?;
    let mut created_params = FavCreatedListParams::new(mid);
    if let Some(rid) = rid.filter(|value| *value > 0) {
        created_params = created_params.with_type(2).with_resource_id(rid)?;
    }

    let created = client.fav().created_list(created_params).await?;
    let mut folders = created
        .list
        .iter()
        .map(created_folder_to_dto)
        .collect::<Vec<_>>();

    let collected = client
        .fav()
        .collected_list(
            FavCollectedListParams::new(mid)
                .with_page(1)?
                .with_page_size(LIBRARY_PAGE_SIZE)?,
        )
        .await?;
    folders.extend(collected.list.iter().map(collected_folder_to_dto));
    Ok(folders)
}

pub async fn favorite_items(
    client: &BpiClient,
    media_id: u64,
    page: Option<u32>,
) -> Result<BiliFavoritePage, BpiError> {
    let params = FavListDetailParams::new(MediaId::new(media_id)?)
        .content_type(2)
        .page_size(LIBRARY_PAGE_SIZE)?
        .page(page.unwrap_or(1))?;
    let detail = client.fav().list_detail(params).await?;
    Ok(BiliFavoritePage {
        items: detail
            .medias
            .iter()
            .filter_map(favorite_media_to_dto)
            .collect(),
        has_more: detail.has_more,
    })
}

pub async fn favorite_video(
    client: &BpiClient,
    rid: u64,
    add_media_ids: Vec<String>,
    del_media_ids: Vec<String>,
) -> Result<BiliOperationResult, BpiError> {
    let params = VideoFavoriteParams::new(rid, add_media_ids, del_media_ids)?;
    let data = client.video().favorite(params).await?;
    Ok(BiliOperationResult::ok(
        data.toast_msg
            .unwrap_or_else(|| "favorite updated".to_string()),
    ))
}

fn history_item_to_dto(item: &HistoryListItem) -> Option<BiliHistoryItem> {
    if item.history.business != "archive" {
        return None;
    }
    let bvid = item
        .history
        .bvid
        .clone()
        .filter(|value| !value.is_empty())?;
    let aid = item.history.oid;
    let cid = item.history.cid.unwrap_or_default();
    let duration = u64::from(item.duration.unwrap_or_default());
    let progress = positive_i32_to_u64(item.progress);
    Some(BiliHistoryItem {
        video: BiliVideoCard {
            bvid,
            aid,
            cid,
            title: clean_text(&item.title),
            cover: item
                .cover
                .as_deref()
                .map(video::normalize_image_url)
                .unwrap_or_default(),
            owner_name: item
                .author_name
                .as_deref()
                .map(clean_text)
                .unwrap_or_default(),
            owner_mid: item.author_mid.unwrap_or_default(),
            duration,
            view_count: 0,
            danmaku_count: 0,
            published_at: 0,
            progress,
        },
        viewed_at: item.view_at,
        page: item.history.page.unwrap_or_default(),
        page_title: item
            .history
            .part
            .as_deref()
            .or(item.show_title.as_deref())
            .map(clean_text)
            .unwrap_or_default(),
    })
}

fn toview_item_to_dto(item: &ToViewVideoItem) -> BiliToViewItem {
    BiliToViewItem {
        video: BiliVideoCard {
            bvid: item.bvid.clone(),
            aid: item.aid,
            cid: item.page.as_ref().map(|page| page.cid).unwrap_or(item.cid),
            title: clean_text(&item.title),
            cover: video::normalize_image_url(&item.pic),
            owner_name: clean_text(&item.owner.name),
            owner_mid: item.owner.mid,
            duration: u64::from(item.duration),
            view_count: item.stat.view,
            danmaku_count: item.stat.danmaku,
            published_at: item.pubdate,
            progress: positive_i32_to_u64(item.progress),
        },
        added_at: item.add_at,
    }
}

fn created_folder_to_dto(item: &CreatedFolderItem) -> BiliFavoriteFolder {
    BiliFavoriteFolder {
        id: item.id,
        title: clean_text(&item.title),
        cover: String::new(),
        owner_mid: item.mid,
        owner_name: String::new(),
        media_count: item.media_count,
        owned: true,
        fav_state: item.fav_state,
    }
}

fn collected_folder_to_dto(item: &CollectedFolderItem) -> BiliFavoriteFolder {
    BiliFavoriteFolder {
        id: item.id,
        title: clean_text(&item.title),
        cover: video::normalize_image_url(&item.cover),
        owner_mid: item.upper.mid,
        owner_name: clean_text(&item.upper.name),
        media_count: item.media_count,
        owned: false,
        fav_state: item.fav_state,
    }
}

fn favorite_media_to_dto(item: &FavListMedia) -> Option<BiliFavoriteItem> {
    if item.type_name != 2 {
        return None;
    }
    Some(BiliFavoriteItem {
        video: BiliVideoCard {
            bvid: item
                .bvid
                .clone()
                .or_else(|| item.bv_id.clone())
                .unwrap_or_default(),
            aid: item.id,
            cid: 0,
            title: clean_text(&item.title),
            cover: video::normalize_image_url(&item.cover),
            owner_name: clean_text(&item.upper.name),
            owner_mid: item.upper.mid,
            duration: u64::from(item.duration),
            view_count: item.cnt_info.play,
            danmaku_count: item.cnt_info.danmaku.unwrap_or_default(),
            published_at: item.pubtime,
            progress: 0,
        },
        media_id: item.id,
        favorite_time: item.fav_time,
    })
}

fn non_zero(value: u64) -> Option<u64> {
    (value > 0).then_some(value)
}

fn positive_i32_to_u64(value: i32) -> u64 {
    u64::try_from(value).unwrap_or_default()
}

fn clean_text(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_progress_clamps_negative_values() {
        assert_eq!(positive_i32_to_u64(-1), 0);
        assert_eq!(positive_i32_to_u64(42), 42);
    }
}
