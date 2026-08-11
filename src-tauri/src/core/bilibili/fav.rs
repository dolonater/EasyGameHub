//! Bilibili 收藏夹管理（P1：文件夹 CRUD + 资源批量删除/移动/复制/清理）。
//!
//! 全部为登录写操作，走 `client::account_client`（未登录返回 auth_required）。

use std::path::Path;

use bpi_rs::fav::params::{
    FavFolderAddParams, FavFolderDeleteParams, FavFolderEditParams, FavResourceBatchDeleteParams,
    FavResourceCleanParams, FavResourceTransferParams,
};
use bpi_rs::ids::{MediaId, Mid};
use bpi_rs::BpiError;

use super::client;

/// 新建收藏夹。
pub async fn folder_create(tool_dir: &Path, title: String) -> Result<(), BpiError> {
    let client = client::account_client(tool_dir)?;
    let params = FavFolderAddParams::new(title)?;
    client.fav().add_folder(params).await?;
    Ok(())
}

/// 重命名收藏夹。
pub async fn folder_edit(tool_dir: &Path, media_id: u64, title: String) -> Result<(), BpiError> {
    let client = client::account_client(tool_dir)?;
    let media_id = MediaId::new(media_id)?;
    let params = FavFolderEditParams::new(media_id, title)?;
    client.fav().edit_folder(params).await?;
    Ok(())
}

/// 删除收藏夹（可批量）。
pub async fn folder_delete(tool_dir: &Path, media_ids: Vec<u64>) -> Result<(), BpiError> {
    if media_ids.is_empty() {
        return Ok(());
    }
    let client = client::account_client(tool_dir)?;
    let ids = media_ids
        .into_iter()
        .map(MediaId::new)
        .collect::<Result<Vec<_>, _>>()?;
    let params = FavFolderDeleteParams::new(ids)?;
    client.fav().delete_folders(params).await?;
    Ok(())
}

/// 资源批量删除。
pub async fn resource_delete(
    tool_dir: &Path,
    media_id: u64,
    resources: Vec<u64>,
) -> Result<(), BpiError> {
    if resources.is_empty() {
        return Ok(());
    }
    let client = client::account_client(tool_dir)?;
    let params = FavResourceBatchDeleteParams::new(MediaId::new(media_id)?, join_rids(&resources))?;
    client.fav().delete_resources(params).await?;
    Ok(())
}

/// 资源移动到其他收藏夹（mid 为当前登录用户，由命令层 current_mid 提供）。
pub async fn resource_move(
    tool_dir: &Path,
    src_media_id: u64,
    tar_media_id: u64,
    resources: Vec<u64>,
    mid: u64,
) -> Result<(), BpiError> {
    if resources.is_empty() {
        return Ok(());
    }
    let client = client::account_client(tool_dir)?;
    let params = FavResourceTransferParams::new(
        MediaId::new(src_media_id)?,
        MediaId::new(tar_media_id)?,
        Mid::new(mid)?,
        join_rids(&resources),
    )?;
    client.fav().move_resources(params).await?;
    Ok(())
}

/// 资源复制到其他收藏夹（mid 为当前登录用户，由命令层 current_mid 提供）。
pub async fn resource_copy(
    tool_dir: &Path,
    src_media_id: u64,
    tar_media_id: u64,
    resources: Vec<u64>,
    mid: u64,
) -> Result<(), BpiError> {
    if resources.is_empty() {
        return Ok(());
    }
    let client = client::account_client(tool_dir)?;
    let params = FavResourceTransferParams::new(
        MediaId::new(src_media_id)?,
        MediaId::new(tar_media_id)?,
        Mid::new(mid)?,
        join_rids(&resources),
    )?;
    client.fav().copy_resources(params).await?;
    Ok(())
}

/// 清空收藏夹中的失效资源。
pub async fn resource_clean(tool_dir: &Path, media_id: u64) -> Result<(), BpiError> {
    let client = client::account_client(tool_dir)?;
    let params = FavResourceCleanParams::new(MediaId::new(media_id)?);
    client.fav().clean_resources(params).await?;
    Ok(())
}

fn join_rids(resources: &[u64]) -> String {
    resources
        .iter()
        .map(|rid| rid.to_string())
        .collect::<Vec<_>>()
        .join(",")
}
