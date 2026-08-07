use tauri::{AppHandle, Manager};

use crate::core::music::models::{
    Album, Artist, CaptchaSentResult, LoginInfo, LoginQrCheckResult, LoginQrKeyResult, Lyrics,
    PlaybackQuality, Playlist, Song, SongUrlResult,
};
use crate::core::music::{cookie, login, netease, proxy};

#[tauri::command]
pub async fn music_open_login_window(app: AppHandle) -> Result<(), String> {
    login::open_login_window(app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_login_qr_key(_app: AppHandle) -> Result<LoginQrKeyResult, String> {
    login::create_qr_key().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_login_qr_check(
    app: AppHandle,
    key: String,
) -> Result<LoginQrCheckResult, String> {
    login::check_qr_login(&app, &key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_login_send_captcha(
    phone: String,
    countrycode: Option<String>,
) -> Result<CaptchaSentResult, String> {
    login::send_captcha(&phone, countrycode.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_login_cellphone(
    app: AppHandle,
    phone: String,
    countrycode: Option<String>,
    captcha: String,
) -> Result<LoginInfo, String> {
    login::login_cellphone(&app, &phone, countrycode.as_deref(), &captcha)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_login_status(app: AppHandle) -> Result<LoginInfo, String> {
    let cookie = match cookie::load_cookie(&app, "netease") {
        Ok(cookie) => cookie,
        Err(_) => {
            return Ok(LoginInfo {
                provider: "netease".into(),
                logged_in: false,
                ..LoginInfo::default()
            });
        }
    };
    netease::login_status(&cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn music_logout(app: AppHandle) -> Result<(), String> {
    cookie::clear_cookie(&app, "netease").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_search(
    app: AppHandle,
    keywords: String,
    limit: Option<u32>,
) -> Result<Vec<Song>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::search(&keywords, limit.unwrap_or(30), &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_user_playlists(app: AppHandle) -> Result<Vec<Playlist>, String> {
    let cookie = cookie::load_cookie(&app, "netease").map_err(|e| e.to_string())?;
    let info = netease::login_status(&cookie)
        .await
        .map_err(|e| e.to_string())?;
    if !info.logged_in {
        return Err("NetEase account is not logged in".into());
    }
    netease::user_playlists(&info.user_id, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_likelist(app: AppHandle) -> Result<Vec<String>, String> {
    let (cookie, info) = logged_in_cookie(&app).await?;
    netease::likelist(&info.user_id, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_like(app: AppHandle, id: String, like: bool) -> Result<(), String> {
    let (cookie, _) = logged_in_cookie(&app).await?;
    netease::like(&id, like, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_playlist_subscribe(
    app: AppHandle,
    id: String,
    subscribe: bool,
) -> Result<(), String> {
    let (cookie, _) = logged_in_cookie(&app).await?;
    netease::playlist_subscribe(&id, subscribe, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_recommend_songs(app: AppHandle) -> Result<Vec<Song>, String> {
    let (cookie, _) = logged_in_cookie(&app).await?;
    netease::recommend_songs(&cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_toplists(app: AppHandle) -> Result<Vec<Playlist>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::toplists(&cookie).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_personalized_playlists(app: AppHandle) -> Result<Vec<Playlist>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::personalized_playlists(&cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_playlist_search(
    app: AppHandle,
    keywords: String,
    limit: Option<u32>,
) -> Result<Vec<Playlist>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::playlist_search(&keywords, limit.unwrap_or(30), &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_album_search(
    app: AppHandle,
    keywords: String,
    limit: Option<u32>,
) -> Result<Vec<Album>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::album_search(&keywords, limit.unwrap_or(30), &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_artist_search(
    app: AppHandle,
    keywords: String,
    limit: Option<u32>,
) -> Result<Vec<Artist>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::artist_search(&keywords, limit.unwrap_or(30), &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_album_songs(app: AppHandle, id: String) -> Result<Vec<Song>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::album_songs(&id, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_artist_songs(app: AppHandle, id: String) -> Result<Vec<Song>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::artist_songs(&id, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_playlist_tracks(
    app: AppHandle,
    id: String,
) -> Result<(Playlist, Vec<Song>), String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::playlist_tracks(&id, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_playlist_tracks_range(
    app: AppHandle,
    id: String,
    start: usize,
    count: usize,
) -> Result<Vec<Song>, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::playlist_tracks_range(&id, start, count, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_song_url(
    app: AppHandle,
    id: String,
    quality: Option<PlaybackQuality>,
) -> Result<SongUrlResult, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::song_url(&id, quality.unwrap_or_default(), &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_lyric(app: AppHandle, id: String) -> Result<Lyrics, String> {
    let cookie = cookie::load_cookie(&app, "netease").unwrap_or_default();
    netease::lyric(&id, &cookie)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_proxy_port(app: AppHandle) -> Result<u16, String> {
    if let Some(port) = proxy::get_proxy_port() {
        return Ok(port);
    }
    let data_dir = app
        .path()
        .app_data_dir()
        .or_else(|_| std::env::current_dir())
        .map_err(|e| e.to_string())?;
    proxy::start_proxy(data_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn music_clear_cover_cache(app: AppHandle) -> Result<usize, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .or_else(|_| std::env::current_dir())
        .map_err(|e| e.to_string())?;
    proxy::clear_cover_cache(data_dir).map_err(|e| e.to_string())
}

async fn logged_in_cookie(app: &AppHandle) -> Result<(String, LoginInfo), String> {
    let cookie = cookie::load_cookie(app, "netease").map_err(|e| e.to_string())?;
    let info = netease::login_status(&cookie)
        .await
        .map_err(|e| e.to_string())?;
    if !info.logged_in {
        return Err("NetEase account is not logged in".into());
    }
    Ok((cookie, info))
}
