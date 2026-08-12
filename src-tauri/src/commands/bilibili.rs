#[cfg(target_os = "windows")]
use std::ffi::CString;

use bpi_rs::video::VideoWatchProgressParams;
use tauri::State;

use crate::core::bilibili::account;
use crate::core::bilibili::article;
use crate::core::bilibili::cache;
use crate::core::bilibili::client;
use crate::core::bilibili::comment;
use crate::core::bilibili::danmaku;
use crate::core::bilibili::dynamic;
use crate::core::bilibili::errors;
use crate::core::bilibili::fav;
use crate::core::bilibili::interaction;
use crate::core::bilibili::library;
use crate::core::bilibili::live;
use crate::core::bilibili::live_bridge;
use crate::core::bilibili::message;
use crate::core::bilibili::models::{
    BiliArticleAuthor, BiliArticleCard, BiliArticleListPage, BiliArticleSearchItem,
    BiliArticleSearchPage, BiliArticleStats, BiliArticleView, BiliBangumiFollow, BiliComment,
    BiliCommentPage, BiliDanmakuItem, BiliDanmakuSendResult, BiliDynamicCard, BiliDynamicCreated,
    BiliDynamicForwardEntry, BiliDynamicForwardsPage, BiliDynamicPage, BiliFavoriteFolder,
    BiliFavoriteItem, BiliFavoritePage, BiliHistoryItem, BiliHotWord, BiliLiveArea,
    BiliLiveRecommendPage, BiliLiveRoom, BiliLiveSendDanmakuResult, BiliLiveStream,
    BiliLocalProgress, BiliLoginInfo, BiliMessageHistoryPage, BiliMessageSessionsPage,
    BiliMessageUnread, BiliNoteDetail, BiliNoteItem, BiliNoteListPage, BiliOperationResult,
    BiliPgcCard, BiliPgcSection, BiliPlaybackSource, BiliPreciousVideos, BiliQrLoginKey,
    BiliQrLoginStatus, BiliReplyFeedPage, BiliSeasonDetail, BiliToViewItem, BiliUserSpace,
    BiliVideoCard, BiliVideoDetail, BiliVideoInteractionState, BiliWeeklySeries,
};
use crate::core::bilibili::note;
use crate::core::bilibili::playback;
use crate::core::bilibili::proxy;
use crate::core::bilibili::ranking;
use crate::core::bilibili::search;
use crate::core::bilibili::season;
use crate::core::bilibili::user_space;
use crate::core::bilibili::video;
use crate::AppState;
use bpi_rs::BpiError;

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
    codec_preference: Option<String>,
    audio_preference: Option<String>,
    season_id: Option<u64>,
    ep_id: Option<u64>,
) -> Result<BiliPlaybackSource, String> {
    let proxy_port = proxy::start_proxy(state.tool_dir.clone())
        .await
        .map_err(proxy_error)?;
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let prefer_progressive = prefer_progressive.unwrap_or(false);
    let preferences = playback::PlaybackPreferences {
        codec: playback::CodecPreference::parse(codec_preference.as_deref()),
        audio: playback::AudioPreference::parse(audio_preference.as_deref()),
    };
    let bvid_value = bvid.unwrap_or_default();
    let aid_value = aid.unwrap_or(0);

    // 番剧单集播放：走 bangumi playurl + 字段级转换复用会话/MPD/代理
    if let Some(ep_id) = ep_id {
        let (session, source) = season::season_ep_playback(
            &state.tool_dir,
            ep_id,
            aid_value,
            cid,
            bvid_value,
            proxy_port,
            prefer_progressive,
            preferences,
        )
        .await
        .map_err(proxy_error)?;
        playback::insert_session(session);
        return Ok(source);
    }

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
            preferences,
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
                    preferences,
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
        &data,
        bvid_value,
        aid_value,
        cid,
        proxy_port,
        false,
        preferences,
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
) -> Result<BiliDanmakuSendResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::send_danmaku(&client, aid, bvid, cid, message, progress)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_danmaku_segment(
    state: State<'_, AppState>,
    cid: u64,
    segment_index: u32,
    aid: Option<u64>,
) -> Result<Vec<BiliDanmakuItem>, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::danmaku_segment(&client, cid, aid, segment_index)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_danmaku_thumbup(
    state: State<'_, AppState>,
    cid: u64,
    dmid: u64,
    like: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::thumbup_danmaku(&client, cid, dmid, like)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_danmaku_report(
    state: State<'_, AppState>,
    cid: u64,
    dmid: u64,
    reason: u8,
    content: Option<String>,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::report_danmaku(&client, cid, dmid, reason, content)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_danmaku_recall(
    state: State<'_, AppState>,
    cid: u64,
    dmid: u64,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    danmaku::recall_danmaku(&client, cid, dmid)
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
) -> Result<BiliFavoritePage, String> {
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
pub async fn bilibili_dynamic_all(
    state: State<'_, AppState>,
    offset: Option<String>,
    host_mid: Option<u64>,
) -> Result<BiliDynamicPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let is_space = host_mid.is_some();
    dynamic::dynamic_all(&client, offset, is_space, host_mid)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_dynamic_detail(
    state: State<'_, AppState>,
    dyn_id: String,
) -> Result<BiliDynamicCard, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    dynamic::dynamic_detail(&client, dyn_id)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_dynamic_like(
    state: State<'_, AppState>,
    dyn_id: String,
    like: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    dynamic::dynamic_like(&client, dyn_id, like)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_dynamic_create_text(
    state: State<'_, AppState>,
    content: String,
) -> Result<BiliDynamicCreated, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    dynamic::dynamic_create_text(&client, content)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_dynamic_top(
    state: State<'_, AppState>,
    dyn_id: String,
    top: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    dynamic::dynamic_top(&client, dyn_id, top)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_dynamic_forwards(
    state: State<'_, AppState>,
    dyn_id: String,
    offset: Option<String>,
) -> Result<BiliDynamicForwardsPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    dynamic::dynamic_forwards(&client, dyn_id, offset)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_message_sessions(
    state: State<'_, AppState>,
    begin_ts: Option<u64>,
) -> Result<BiliMessageSessionsPage, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    message::message_sessions(&client, begin_ts)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_message_history(
    state: State<'_, AppState>,
    talker_uid: u64,
    cursor: Option<u64>,
) -> Result<BiliMessageHistoryPage, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    message::message_history(&client, talker_uid, cursor)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_message_send(
    state: State<'_, AppState>,
    uid: u64,
    content: String,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    message::message_send(&client, uid, content)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_message_unread(
    state: State<'_, AppState>,
) -> Result<BiliMessageUnread, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    message::message_unread(&client).await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_message_reply_feed(
    state: State<'_, AppState>,
    start_id: Option<u64>,
    start_time: Option<u64>,
) -> Result<BiliReplyFeedPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    message::message_reply_feed(&client, start_id, start_time)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_comment_list(
    state: State<'_, AppState>,
    oid: String,
    page: Option<u32>,
    sort: Option<String>,
    r#type: Option<i64>,
) -> Result<BiliCommentPage, String> {
    let cache_key = format!(
        "{}:{}:{}:{}:{}",
        current_mid_optional(&state.tool_dir)?.unwrap_or(0),
        oid,
        page.unwrap_or(1),
        sort.as_deref().unwrap_or("replies"),
        r#type.unwrap_or(1),
    );
    if let Some(cached) =
        cache::load_json(&state.tool_dir, "comments", &cache_key).map_err(bpi_error)?
    {
        return Ok(cached);
    }
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let current_mid = current_mid_optional(&state.tool_dir)?;
    let data = comment::list(
        &client,
        parse_comment_oid(oid)?,
        page,
        sort,
        current_mid,
        r#type,
    )
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
    oid: String,
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
    let data = comment::replies(&client, parse_comment_oid(oid)?, root, page, current_mid)
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
    oid: String,
    message: String,
    root: Option<u64>,
    parent: Option<u64>,
) -> Result<BiliComment, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let current_mid = Some(current_mid(&state.tool_dir)?);
    let data = comment::add(
        &client,
        parse_comment_oid(oid)?,
        message,
        root,
        parent,
        current_mid,
    )
    .await
    .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(data)
}

#[tauri::command]
pub async fn bilibili_comment_like(
    state: State<'_, AppState>,
    oid: String,
    rpid: u64,
    like: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::like(&client, parse_comment_oid(oid)?, rpid, like)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_dislike(
    state: State<'_, AppState>,
    oid: String,
    rpid: u64,
    dislike: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::dislike(&client, parse_comment_oid(oid)?, rpid, dislike)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_delete(
    state: State<'_, AppState>,
    oid: String,
    rpid: u64,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::delete(&client, parse_comment_oid(oid)?, rpid)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_top(
    state: State<'_, AppState>,
    oid: String,
    rpid: u64,
    top: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    let result = comment::top(&client, parse_comment_oid(oid)?, rpid, top)
        .await
        .map_err(bpi_error)?;
    clear_comment_cache(&state.tool_dir);
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_comment_report(
    state: State<'_, AppState>,
    oid: String,
    rpid: u64,
    reason: String,
    content: Option<String>,
) -> Result<BiliOperationResult, String> {
    let client = client::account_client(&state.tool_dir).map_err(bpi_error)?;
    comment::report(&client, parse_comment_oid(oid)?, rpid, reason, content)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub fn bilibili_clear_cache(state: State<'_, AppState>) -> Result<usize, String> {
    cache::clear_cache(&state.tool_dir).map_err(bpi_error)
}

/// 分区视频排行榜（rid=0 或缺省为全站）。
#[tauri::command]
pub async fn bilibili_ranking_videos(rid: Option<u32>) -> Result<Vec<BiliVideoCard>, String> {
    ranking::ranking_videos(rid).await.map_err(bpi_error)
}

/// 每周必看期列表。
#[tauri::command]
pub async fn bilibili_weekly_series_list() -> Result<Vec<BiliWeeklySeries>, String> {
    ranking::weekly_series_list().await.map_err(bpi_error)
}

/// 每周必看单期视频列表。
#[tauri::command]
pub async fn bilibili_weekly_series_one(number: u32) -> Result<Vec<BiliVideoCard>, String> {
    ranking::weekly_series_one(number).await.map_err(bpi_error)
}

/// 入站必刷（精选必看）。
#[tauri::command]
pub async fn bilibili_precious_videos() -> Result<BiliPreciousVideos, String> {
    ranking::precious_videos().await.map_err(bpi_error)
}

/// 搜索输入联想（空关键词返回空数组）。
#[tauri::command]
pub async fn bilibili_search_suggest(keyword: String) -> Result<Vec<String>, String> {
    search::suggest(&keyword).await.map_err(bpi_error)
}

/// 热搜榜。
#[tauri::command]
pub async fn bilibili_search_hotwords() -> Result<Vec<BiliHotWord>, String> {
    search::hotwords().await.map_err(bpi_error)
}

/// 新建收藏夹。
#[tauri::command]
pub async fn bilibili_fav_folder_create(
    state: State<'_, AppState>,
    title: String,
) -> Result<(), String> {
    fav::folder_create(&state.tool_dir, title)
        .await
        .map_err(bpi_error)
}

/// 重命名收藏夹。
#[tauri::command]
pub async fn bilibili_fav_folder_edit(
    state: State<'_, AppState>,
    media_id: u64,
    title: String,
) -> Result<(), String> {
    fav::folder_edit(&state.tool_dir, media_id, title)
        .await
        .map_err(bpi_error)
}

/// 删除收藏夹（可批量）。
#[tauri::command]
pub async fn bilibili_fav_folder_delete(
    state: State<'_, AppState>,
    media_ids: Vec<u64>,
) -> Result<(), String> {
    fav::folder_delete(&state.tool_dir, media_ids)
        .await
        .map_err(bpi_error)
}

/// 收藏夹资源批量删除。
#[tauri::command]
pub async fn bilibili_fav_resource_delete(
    state: State<'_, AppState>,
    media_id: u64,
    resources: Vec<u64>,
) -> Result<(), String> {
    fav::resource_delete(&state.tool_dir, media_id, resources)
        .await
        .map_err(bpi_error)
}

/// 收藏夹资源移动到其他收藏夹。
#[tauri::command]
pub async fn bilibili_fav_resource_move(
    state: State<'_, AppState>,
    src_media_id: u64,
    tar_media_id: u64,
    resources: Vec<u64>,
) -> Result<(), String> {
    let mid = current_mid(&state.tool_dir)?;
    fav::resource_move(&state.tool_dir, src_media_id, tar_media_id, resources, mid)
        .await
        .map_err(bpi_error)
}

/// 收藏夹资源复制到其他收藏夹。
#[tauri::command]
pub async fn bilibili_fav_resource_copy(
    state: State<'_, AppState>,
    src_media_id: u64,
    tar_media_id: u64,
    resources: Vec<u64>,
) -> Result<(), String> {
    let mid = current_mid(&state.tool_dir)?;
    fav::resource_copy(&state.tool_dir, src_media_id, tar_media_id, resources, mid)
        .await
        .map_err(bpi_error)
}

/// 清空收藏夹中失效资源。
#[tauri::command]
pub async fn bilibili_fav_resource_clean(
    state: State<'_, AppState>,
    media_id: u64,
) -> Result<(), String> {
    fav::resource_clean(&state.tool_dir, media_id)
        .await
        .map_err(bpi_error)
}

/// UP 主页聚合信息（信息卡 + 统计 + 直播状态）。
#[tauri::command]
pub async fn bilibili_user_space(
    state: State<'_, AppState>,
    mid: u64,
) -> Result<BiliUserSpace, String> {
    user_space::user_space(&state.tool_dir, mid)
        .await
        .map_err(bpi_error)
}

/// UP 投稿视频列表。
#[tauri::command]
pub async fn bilibili_user_videos(
    state: State<'_, AppState>,
    mid: u64,
    page: Option<u32>,
) -> Result<Vec<BiliVideoCard>, String> {
    user_space::user_videos(&state.tool_dir, mid, page)
        .await
        .map_err(bpi_error)
}

/// 关注 / 取关 UP。
#[tauri::command]
pub async fn bilibili_user_follow(
    state: State<'_, AppState>,
    mid: u64,
    follow: bool,
) -> Result<(), String> {
    user_space::user_follow(&state.tool_dir, mid, follow)
        .await
        .map_err(bpi_error)
}

/// 番剧详情（含分集列表与追番态）。
#[tauri::command]
pub async fn bilibili_season_detail(
    state: State<'_, AppState>,
    season_id: u64,
) -> Result<BiliSeasonDetail, String> {
    season::season_detail(&state.tool_dir, season_id)
        .await
        .map_err(bpi_error)
}

/// 追番 / 取消追番。
#[tauri::command]
pub async fn bilibili_season_follow(
    state: State<'_, AppState>,
    season_id: u64,
    follow: bool,
) -> Result<(), String> {
    season::season_follow(&state.tool_dir, season_id, follow)
        .await
        .map_err(bpi_error)
}

/// 追番/影视页聚合数据（kind: "bangumi" | "cinema"）。
#[tauri::command]
pub async fn bilibili_pgc_tabs(
    state: State<'_, AppState>,
    kind: String,
) -> Result<Vec<BiliPgcSection>, String> {
    let kind = match kind.as_str() {
        "bangumi" => season::PgcTabKind::Bangumi,
        "cinema" => season::PgcTabKind::Cinema,
        _ => {
            return Err(bpi_error(BpiError::invalid_parameter(
                "kind",
                "kind must be bangumi or cinema",
            )))
        }
    };
    season::pgc_tabs(&state.tool_dir, kind)
        .await
        .map_err(bpi_error)
}

/// PGC 排行榜分榜（1=番剧 2=电影 3=纪录片 4=国创 5=电视剧 7=综艺）。
#[tauri::command]
pub async fn bilibili_pgc_rank(
    state: State<'_, AppState>,
    season_type: u32,
) -> Result<Vec<BiliPgcCard>, String> {
    season::pgc_rank(&state.tool_dir, season_type)
        .await
        .map_err(bpi_error)
}

/// 我的追番/追影视列表（cinema=false 番剧，true 影视）。
#[tauri::command]
pub async fn bilibili_bangumi_follow_list(
    state: State<'_, AppState>,
    page: Option<u32>,
    cinema: Option<bool>,
) -> Result<Vec<BiliBangumiFollow>, String> {
    let mid = current_mid(&state.tool_dir)?;
    season::bangumi_follow_list(&state.tool_dir, mid, page, cinema.unwrap_or(false))
        .await
        .map_err(bpi_error)
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

/// 评论 oid 解析：dyn_id 超过 2^53（JS Number 丢精度），前端统一传字符串。
fn parse_comment_oid(value: String) -> Result<u64, String> {
    value
        .trim()
        .parse::<u64>()
        .map_err(|_| format!("invalid oid: {value}"))
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

// ---------- P6 直播 ----------

#[tauri::command]
pub async fn bilibili_live_room(
    state: State<'_, AppState>,
    room_id: i64,
) -> Result<BiliLiveRoom, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    live::room(&client, room_id).await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_live_stream(
    state: State<'_, AppState>,
    room_id: i64,
    qn: Option<i32>,
) -> Result<BiliLiveStream, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    let mut result = live::stream(&client, room_id, qn)
        .await
        .map_err(bpi_error)?;
    // 浏览器无法直连 B 站直播 CDN（Referer 校验 403）：主线路换成本地代理地址
    let port = proxy::start_proxy(state.tool_dir.clone())
        .await
        .map_err(proxy_error)?;
    if let Some(first) = result.durl.first_mut() {
        if let Some(proxy_url) = live::register_proxied_stream(first.url.clone(), port) {
            first.url = proxy_url;
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn bilibili_live_recommend(
    state: State<'_, AppState>,
    page: Option<u32>,
) -> Result<BiliLiveRecommendPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    live::recommend(&client, page).await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_live_areas(state: State<'_, AppState>) -> Result<Vec<BiliLiveArea>, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    live::areas(&client).await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_live_send_danmaku(
    state: State<'_, AppState>,
    room_id: u64,
    text: String,
) -> Result<BiliLiveSendDanmakuResult, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    live::send_danmaku(&client, room_id, &text)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_live_heartbeat(
    state: State<'_, AppState>,
    room_id: u64,
) -> Result<BiliOperationResult, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    live::heartbeat(&client, room_id).await.map_err(bpi_error)?;
    Ok(BiliOperationResult::ok("live heartbeat"))
}

// ---------- P8 专栏 / 笔记 ----------

#[tauri::command]
pub async fn bilibili_article_view(
    state: State<'_, AppState>,
    article_id: i64,
) -> Result<BiliArticleView, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    article::article_view(&client, article_id)
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_article_like(
    state: State<'_, AppState>,
    article_id: i64,
    like: bool,
) -> Result<BiliOperationResult, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    article::article_like(&client, article_id, like)
        .await
        .map_err(bpi_error)?;
    Ok(BiliOperationResult::ok("article like"))
}

#[tauri::command]
pub async fn bilibili_article_coin(
    state: State<'_, AppState>,
    article_id: i64,
    upid: i64,
) -> Result<BiliOperationResult, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    article::article_coin(&client, article_id, upid)
        .await
        .map_err(bpi_error)?;
    Ok(BiliOperationResult::ok("article coin"))
}

#[tauri::command]
pub async fn bilibili_article_list(
    state: State<'_, AppState>,
    mid: i64,
    page: Option<u32>,
) -> Result<BiliArticleListPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    article::article_list(&client, mid, page.unwrap_or(1))
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_search_articles(
    state: State<'_, AppState>,
    keyword: String,
    page: Option<u32>,
) -> Result<BiliArticleSearchPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    article::search_articles(&client, &keyword, page.unwrap_or(1))
        .await
        .map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_note_list(
    state: State<'_, AppState>,
    aid: u64,
) -> Result<BiliNoteListPage, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    note::note_list(&client, aid).await.map_err(bpi_error)
}

#[tauri::command]
pub async fn bilibili_note_detail(
    state: State<'_, AppState>,
    cvid: u64,
    note_id: u64,
    aid: u64,
) -> Result<BiliNoteDetail, String> {
    let client = client::optional_account_client(&state.tool_dir).map_err(bpi_error)?;
    note::note_detail(&client, cvid, note_id, aid)
        .await
        .map_err(bpi_error)
}
