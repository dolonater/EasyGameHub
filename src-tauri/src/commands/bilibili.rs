#[cfg(target_os = "windows")]
use std::ffi::CString;

use bpi_rs::video::VideoWatchProgressParams;
use tauri::State;

use crate::core::bilibili::account;
use crate::core::bilibili::cache;
use crate::core::bilibili::client;
use crate::core::bilibili::comment;
use crate::core::bilibili::danmaku;
use crate::core::bilibili::errors;
use crate::core::bilibili::interaction;
use crate::core::bilibili::library;
use crate::core::bilibili::models::{
    BiliComment, BiliCommentPage, BiliDanmakuItem, BiliFavoriteFolder, BiliFavoriteItem,
    BiliHistoryItem, BiliLocalProgress, BiliLoginInfo, BiliOperationResult, BiliPlaybackSource,
    BiliQrLoginKey, BiliQrLoginStatus, BiliToViewItem, BiliVideoCard, BiliVideoDetail,
    BiliVideoInteractionState,
};
use crate::core::bilibili::playback;
use crate::core::bilibili::proxy;
use crate::core::bilibili::video;
use crate::AppState;
use bpi_rs::BpiError;

#[tauri::command]
pub fn bilibili_ping() -> Result<BiliOperationResult, String> {
    Ok(BiliOperationResult::ok("bilibili ready"))
}

#[tauri::command]
pub async fn bilibili_login_qr_key() -> Result<BiliQrLoginKey, String> {
    account::login_qr_key().await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_login_qr_check(
    state: State<'_, AppState>,
    key: String,
) -> Result<BiliQrLoginStatus, String> {
    account::login_qr_check(&state.tool_dir, &key)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_login_status(state: State<'_, AppState>) -> Result<BiliLoginInfo, String> {
    client::login_status(&state.tool_dir)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub fn bilibili_logout(state: State<'_, AppState>) -> Result<BiliOperationResult, String> {
    account::clear_cookie(&state.tool_dir).map_err(bpi_error)?;
    Ok(BiliOperationResult::ok("bilibili logged out"))
}

#[tauri::command]
pub async fn bilibili_search_videos(
    state: State<'_, AppState>,
    keywords: String,
    page: Option<u32>,
    refresh: Option<bool>,
) -> Result<Vec<BiliVideoCard>, String> {
    let cache_key = format!("{}:{}", keywords.trim(), page.unwrap_or(1));
    if !refresh.unwrap_or(false) {
        if let Some(cached) =
            cache::load_json(&state.tool_dir, "search", &cache_key).map_err(bpi_error)?
        {
            return Ok(cached);
        }
    }
    let data = video::search_videos(&keywords, page)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "search",
        &cache_key,
        cache::SEARCH_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_popular_videos(
    state: State<'_, AppState>,
    page: Option<u32>,
    refresh: Option<bool>,
) -> Result<Vec<BiliVideoCard>, String> {
    let cache_key = page.unwrap_or(1).to_string();
    if !refresh.unwrap_or(false) {
        if let Some(cached) =
            cache::load_json(&state.tool_dir, "popular", &cache_key).map_err(bpi_error)?
        {
            return Ok(cached);
        }
    }
    let data = video::popular_videos(page).await.map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "popular",
        &cache_key,
        cache::POPULAR_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_recommend_videos(
    state: State<'_, AppState>,
    page: Option<u32>,
    refresh: Option<bool>,
) -> Result<Vec<BiliVideoCard>, String> {
    let page = page.unwrap_or(1).max(1);
    let cache_key = page.to_string();
    if !refresh.unwrap_or(false) {
        if let Some(cached) =
            cache::load_json(&state.tool_dir, "recommend", &cache_key).map_err(bpi_error)?
        {
            return Ok(cached);
        }
    }
    let data = video::recommend_videos(Some(page))
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "recommend",
        &cache_key,
        cache::POPULAR_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_video_detail(
    state: State<'_, AppState>,
    bvid: Option<String>,
    aid: Option<u64>,
) -> Result<BiliVideoDetail, String> {
    let current_mid = current_mid_optional(&state.tool_dir)?.unwrap_or(0);
    let cache_key = format!(
        "{}:{}:{}",
        current_mid,
        bvid.as_deref().unwrap_or_default(),
        aid.unwrap_or(0)
    );
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "video-detail", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let data = video::video_detail(&state.tool_dir, bvid, aid)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "video-detail",
        &cache_key,
        cache::VIDEO_DETAIL_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_related_videos(
    bvid: Option<String>,
    aid: Option<u64>,
) -> Result<Vec<BiliVideoCard>, String> {
    video::related_videos(bvid, aid).await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_proxy_port(state: State<'_, AppState>) -> Result<u16, String> {
    proxy::start_proxy(state.tool_dir.clone())
        .await
        .map_err(proxy_error)
}

#[tauri::command]
pub async fn bilibili_create_playback(
    state: State<'_, AppState>,
    bvid: Option<String>,
    aid: Option<u64>,
    cid: u64,
    quality: Option<u32>,
    prefer_progressive: Option<bool>,
) -> Result<BiliPlaybackSource, String> {
    let proxy_port = proxy::start_proxy(state.tool_dir.clone())
        .await
        .map_err(proxy_error)?;
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let prefer_progressive = prefer_progressive.unwrap_or(false);
    let bvid_value = bvid.unwrap_or_default();
    let aid_value = aid.unwrap_or(0);

    if prefer_progressive {
        let params = video::play_url_params(
            Some(bvid_value.as_str()).filter(|value| !value.is_empty()),
            (aid_value > 0).then_some(aid_value),
            cid,
            quality,
            true,
        )
        .map_err(bpi_error)?;
        let data = client.video().play_url(params).await.map_err(bpi_error)?;
        match playback::create_session_from_stream_with_options(
            &data,
            bvid_value.clone(),
            aid_value,
            cid,
            proxy_port,
            true,
        ) {
            Ok((session, source)) => {
                playback::insert_session(session);
                return Ok(source);
            }
            Err(progressive_error) => {
                let params = video::play_url_params(
                    Some(bvid_value.as_str()).filter(|value| !value.is_empty()),
                    (aid_value > 0).then_some(aid_value),
                    cid,
                    quality,
                    false,
                )
                .map_err(bpi_error)?;
                let data = client.video().play_url(params).await.map_err(bpi_error)?;
                let (session, source) = playback::create_session_from_stream_with_options(
                    &data,
                    bvid_value,
                    aid_value,
                    cid,
                    proxy_port,
                    false,
                )
                .map_err(|dash_error| {
                    proxy_error(format!(
                        "progressive playback failed: {progressive_error}; dash playback failed: {dash_error}"
                    ))
                })?;
                playback::insert_session(session);
                return Ok(source);
            }
        }
    }

    let params = video::play_url_params(
        Some(bvid_value.as_str()).filter(|value| !value.is_empty()),
        (aid_value > 0).then_some(aid_value),
        cid,
        quality,
        false,
    )
    .map_err(bpi_error)?;
    let data = client.video().play_url(params).await.map_err(bpi_error)?;
    let (session, source) = playback::create_session_from_stream_with_options(
        &data, bvid_value, aid_value, cid, proxy_port, false,
    )
    .map_err(proxy_error)?;
    playback::insert_session(session);
    Ok(source)
}

#[tauri::command]
pub fn bilibili_save_local_progress(
    state: State<'_, AppState>,
    bvid: String,
    aid: u64,
    cid: u64,
    progress_seconds: u64,
) -> Result<BiliLocalProgress, String> {
    cache::save_local_progress(&state.tool_dir, bvid, aid, cid, progress_seconds).map_err(bpi_error)
}

#[tauri::command]
pub fn bilibili_load_local_progress(
    state: State<'_, AppState>,
    bvid: String,
    cid: Option<u64>,
) -> Result<Option<BiliLocalProgress>, String> {
    cache::load_local_progress(&state.tool_dir, &bvid, cid).map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_report_progress(
    state: State<'_, AppState>,
    aid: u64,
    cid: u64,
    progress: u64,
) -> Result<BiliOperationResult, String> {
    if account::load_cookie(&state.tool_dir)
        .map_err(bpi_error)?
        .is_none()
    {
        return Ok(BiliOperationResult {
            ok: false,
            message: "notLoggedIn".to_string(),
        });
    }

    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let params = VideoWatchProgressParams::new(aid, cid)
        .map_err(bpi_error)?
        .progress(progress);
    client
        .video()
        .report_watch_progress(params)
        .await
        .map_err(bpi_error)?;
    Ok(BiliOperationResult::ok("progress reported"))
}

#[tauri::command]
pub fn bilibili_open_video(bvid: String) -> Result<BiliOperationResult, String> {
    let bvid = bvid.trim();
    if bvid.is_empty() || !bvid.chars().all(|ch| ch.is_ascii_alphanumeric()) {
        return Err(bpi_error(BpiError::invalid_parameter(
            "bvid",
            "value must be a Bilibili video id",
        )));
    }
    open_external_target(&format!("https://www.bilibili.com/video/{bvid}"))?;
    Ok(BiliOperationResult::ok("video opened"))
}

#[tauri::command]
pub fn bilibili_save_screenshot(
    state: State<'_, AppState>,
    file_name: String,
    data_base64: String,
) -> Result<String, String> {
    cache::save_screenshot(&state.tool_dir, &file_name, &data_base64)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(bpi_error)
}

#[tauri::command]
pub fn bilibili_open_screenshot_folder(
    state: State<'_, AppState>,
) -> Result<BiliOperationResult, String> {
    let dir = cache::screenshots_dir(&state.tool_dir);
    std::fs::create_dir_all(&dir).map_err(|e| proxy_error(e))?;
    open_external_target(dir.to_string_lossy().as_ref())?;
    Ok(BiliOperationResult::ok("screenshot folder opened"))
}

#[tauri::command]
pub async fn bilibili_danmaku_list(
    state: State<'_, AppState>,
    cid: u64,
    aid: Option<u64>,
    bvid: Option<String>,
) -> Result<Vec<BiliDanmakuItem>, String> {
    let _ = bvid;
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::danmaku_list(&client, cid, aid)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_send_danmaku(
    state: State<'_, AppState>,
    aid: u64,
    bvid: String,
    cid: u64,
    message: String,
    progress: u32,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::send_danmaku(&client, aid, bvid, cid, message, progress)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_history_list(
    state: State<'_, AppState>,
    page: Option<u32>,
) -> Result<Vec<BiliHistoryItem>, String> {
    let cache_key = format!("{}:{}", current_mid(&state.tool_dir)?, page.unwrap_or(1));
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "history", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let data = library::history_list(&client, page)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "history",
        &cache_key,
        cache::HISTORY_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_toview_list(
    state: State<'_, AppState>,
) -> Result<Vec<BiliToViewItem>, String> {
    let cache_key = current_mid(&state.tool_dir)?.to_string();
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "toview", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let data = library::toview_list(&client).await.map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "toview",
        &cache_key,
        cache::TOVIEW_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_toview_add(
    state: State<'_, AppState>,
    aid: u64,
    bvid: Option<String>,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = library::add_toview(&client, aid, bvid)
        .await
        .map_err(bpi_error)?;
    let _ = cache::clear_namespace(&state.tool_dir, "toview");
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_toview_remove(
    state: State<'_, AppState>,
    aid: u64,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = library::remove_toview(&client, aid)
        .await
        .map_err(bpi_error)?;
    let _ = cache::clear_namespace(&state.tool_dir, "toview");
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_favorite_folders(
    state: State<'_, AppState>,
    rid: Option<u64>,
) -> Result<Vec<BiliFavoriteFolder>, String> {
    let cache_key = format!("{}:{}", current_mid(&state.tool_dir)?, rid.unwrap_or(0));
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "favorite-folders", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let mid = current_mid(&state.tool_dir)?;
    let data = library::favorite_folders(&client, mid, rid)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "favorite-folders",
        &cache_key,
        cache::FAVORITE_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_favorite_items(
    state: State<'_, AppState>,
    media_id: u64,
    page: Option<u32>,
) -> Result<Vec<BiliFavoriteItem>, String> {
    let cache_key = format!(
        "{}:{}:{}",
        current_mid(&state.tool_dir)?,
        media_id,
        page.unwrap_or(1)
    );
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "favorite-items", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let data = library::favorite_items(&client, media_id, page)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "favorite-items",
        &cache_key,
        cache::FAVORITE_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_favorite_video(
    state: State<'_, AppState>,
    rid: u64,
    add_media_ids: Vec<String>,
    del_media_ids: Vec<String>,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = library::favorite_video(&client, rid, add_media_ids, del_media_ids)
        .await
        .map_err(bpi_error)?;
    let _ = cache::clear_namespace(&state.tool_dir, "favorite-folders");
    let _ = cache::clear_namespace(&state.tool_dir, "favorite-items");
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_interaction_state(
    state: State<'_, AppState>,
    bvid: Option<String>,
    aid: Option<u64>,
    owner_mid: Option<u64>,
) -> Result<BiliVideoInteractionState, String> {
    interaction::interaction_state(&state.tool_dir, bvid, aid, owner_mid)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_like_video(
    state: State<'_, AppState>,
    bvid: Option<String>,
    aid: Option<u64>,
    liked: bool,
) -> Result<BiliVideoInteractionState, String> {
    let result = interaction::like_video(&state.tool_dir, bvid, aid, liked)
        .await
        .map_err(bpi_error)?;
    clear_video_interaction_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_coin_video(
    state: State<'_, AppState>,
    bvid: Option<String>,
    aid: Option<u64>,
    multiply: u8,
    also_like: bool,
) -> Result<BiliVideoInteractionState, String> {
    let result = interaction::coin_video(&state.tool_dir, bvid, aid, multiply, also_like)
        .await
        .map_err(bpi_error)?;
    clear_video_interaction_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_favorite_video_interaction(
    state: State<'_, AppState>,
    rid: u64,
    add_media_ids: Vec<String>,
    del_media_ids: Vec<String>,
) -> Result<BiliVideoInteractionState, String> {
    let result =
        interaction::favorite_video_interaction(&state.tool_dir, rid, add_media_ids, del_media_ids)
            .await
            .map_err(bpi_error)?;
    let _ = cache::clear_namespace(&state.tool_dir, "favorite-folders");
    let _ = cache::clear_namespace(&state.tool_dir, "favorite-items");
    clear_video_interaction_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_toview_video_interaction(
    state: State<'_, AppState>,
    aid: u64,
    bvid: Option<String>,
    to_view: bool,
) -> Result<BiliVideoInteractionState, String> {
    let result = interaction::toview_video_interaction(&state.tool_dir, aid, bvid, to_view)
        .await
        .map_err(bpi_error)?;
    let _ = cache::clear_namespace(&state.tool_dir, "toview");
    clear_video_interaction_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_follow_owner(
    state: State<'_, AppState>,
    mid: u64,
    following: bool,
    bvid: Option<String>,
    aid: Option<u64>,
) -> Result<BiliVideoInteractionState, String> {
    let result = interaction::follow_owner(&state.tool_dir, mid, following, bvid, aid)
        .await
        .map_err(bpi_error)?;
    clear_video_interaction_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub fn bilibili_copy_share_link(bvid: String) -> Result<BiliOperationResult, String> {
    interaction::copy_share_link(&bvid).map_err(bpi_error)
}

#[tauri::command]
pub fn bilibili_open_report(bvid: String) -> Result<BiliOperationResult, String> {
    let url = interaction::share_link(&bvid).map_err(bpi_error)?;
    open_external_target(&url)?;
    Ok(BiliOperationResult::ok("report page opened"))
}

#[tauri::command]
pub async fn bilibili_comment_list(
    state: State<'_, AppState>,
    oid: u64,
    page: Option<u32>,
    sort: Option<String>,
) -> Result<BiliCommentPage, String> {
    let cache_key = format!(
        "{}:{}:{}:{}",
        current_mid_optional(&state.tool_dir)?.unwrap_or(0),
        oid,
        page.unwrap_or(1),
        sort.as_deref().unwrap_or("replies")
    );
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "comments", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let current_mid = current_mid_optional(&state.tool_dir)?;
    let data = comment::list(&client, oid, page, sort, current_mid)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "comments",
        &cache_key,
        cache::COMMENT_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_comment_replies(
    state: State<'_, AppState>,
    oid: u64,
    root: u64,
    page: Option<u32>,
) -> Result<BiliCommentPage, String> {
    let cache_key = format!(
        "{}:{}:{}:{}",
        current_mid_optional(&state.tool_dir)?.unwrap_or(0),
        oid,
        root,
        page.unwrap_or(1)
    );
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "comment-replies", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let current_mid = current_mid_optional(&state.tool_dir)?;
    let data = comment::replies(&client, oid, root, page, current_mid)
        .await
        .map_err(bpi_error)?;
    cache::save_json(
        &state.tool_dir,
        "comment-replies",
        &cache_key,
        cache::COMMENT_TTL,
        &data,
    )
    .map_err(bpi_error)?;
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_comment_add(
    state: State<'_, AppState>,
    oid: u64,
    message: String,
    root: Option<u64>,
    parent: Option<u64>,
) -> Result<BiliComment, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let current_mid = Some(current_mid(&state.tool_dir)?);
    let data = comment::add(&client, oid, message, root, parent, current_mid)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_comment_like(
    state: State<'_, AppState>,
    oid: u64,
    rpid: u64,
    like: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::like(&client, oid, rpid, like)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_dislike(
    state: State<'_, AppState>,
    oid: u64,
    rpid: u64,
    dislike: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::dislike(&client, oid, rpid, dislike)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_delete(
    state: State<'_, AppState>,
    oid: u64,
    rpid: u64,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::delete(&client, oid, rpid)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_top(
    state: State<'_, AppState>,
    oid: u64,
    rpid: u64,
    top: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::top(&client, oid, rpid, top)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_report(
    state: State<'_, AppState>,
    oid: u64,
    rpid: u64,
    reason: String,
    content: Option<String>,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    comment::report(&client, oid, rpid, reason, content)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub fn bilibili_clear_cache(state: State<'_, AppState>) -> Result<usize, String> {
    cache::clear_cache(&state.tool_dir).map_err(bpi_error)
}

fn current_mid(tool_dir: &std::path::Path) -> Result<u64, String> {
    let cookie = account::load_cookie(tool_dir)
        .map_err(bpi_error)?
        .ok_or_else(|| bpi_error(BpiError::auth_required()))?;
    let account = account::cookie_to_account(&cookie)
        .ok_or_else(|| bpi_error(BpiError::auth("invalid login cookie")))?;
    account
        .dede_user_id
        .parse::<u64>()
        .map_err(|_| {
            bpi_error(BpiError::invalid_parameter(
                "mid",
                "invalid Bilibili user id",
            ))
        })
        .and_then(|mid| {
            if mid > 0 {
                Ok(mid)
            } else {
                Err(bpi_error(BpiError::invalid_parameter(
                    "mid",
                    "invalid Bilibili user id",
                )))
            }
        })
}

fn current_mid_optional(tool_dir: &std::path::Path) -> Result<Option<u64>, String> {
    let Some(cookie) = account::load_cookie(tool_dir).map_err(|e| e.to_string())? else {
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

fn clear_comment_cache(tool_dir: &std::path::Path) {
    let _ = cache::clear_namespace(tool_dir, "comments");
    let _ = cache::clear_namespace(tool_dir, "comment-replies");
}

fn clear_video_interaction_cache(tool_dir: &std::path::Path) {
    let _ = cache::clear_namespace(tool_dir, "video-detail");
}

fn bpi_error(error: BpiError) -> String {
    serde_json::to_string(&errors::to_error_dto(&error)).unwrap_or_else(|_| error.to_string())
}

fn proxy_error(error: impl std::fmt::Display) -> String {
    let dto = crate::core::bilibili::models::BiliErrorDto::new(
        crate::core::bilibili::models::BiliErrorKind::Proxy,
        error.to_string(),
        true,
    );
    serde_json::to_string(&dto).unwrap_or_else(|_| error.to_string())
}

fn open_external_target(target: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::Shell::ShellExecuteA;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let operation = CString::new("open").map_err(|e| format!("Invalid operation: {e}"))?;
        let target = CString::new(target).map_err(|e| format!("Invalid target: {e}"))?;
        let result = unsafe {
            ShellExecuteA(
                std::ptr::null_mut(),
                operation.as_ptr() as *const u8,
                target.as_ptr() as *const u8,
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;

        if result <= 32 {
            return Err(format!("Failed to open target via ShellExecute: {result}"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Failed to open target: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Failed to open target: {e}"))?;
    }
    Ok(())
}
