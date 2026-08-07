use std::sync::OnceLock;
use std::time::Duration;

use reqwest::header::{COOKIE, REFERER, USER_AGENT};
use serde_json::{json, Value};

use super::{
    cookie,
    models::{Album, Artist, LoginInfo, Lyrics, PlaybackQuality, Playlist, Song, SongUrlResult},
    weapi,
};

const BASE: &str = "https://music.163.com";
const REFERER_VALUE: &str = "https://music.163.com/";
const USER_AGENT_VALUE: &str = "Mozilla/5.0 EasyGameHub/0.1";
const SONG_URL_V1_WEAPI: &str = "https://music.163.com/weapi/song/enhance/player/url/v1";
static REQUEST_STRATEGY_COOKIE: OnceLock<String> = OnceLock::new();

fn client() -> Result<reqwest::Client, anyhow::Error> {
    Ok(reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(USER_AGENT_VALUE)
        .build()?)
}

async fn get_json(path: &str, cookie: &str) -> Result<Value, anyhow::Error> {
    let url = if path.starts_with("http") {
        path.to_string()
    } else {
        format!("{BASE}{path}")
    };
    let cookie_header = request_cookie(cookie);
    let res = client()?
        .get(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(REFERER, REFERER_VALUE)
        .header(COOKIE, cookie_header)
        .send()
        .await?
        .error_for_status()?;
    Ok(res.json::<Value>().await?)
}

async fn post_json(
    path: &str,
    form: &[(&str, String)],
    cookie: &str,
) -> Result<Value, anyhow::Error> {
    let cookie_header = request_cookie(cookie);
    let res = client()?
        .post(format!("{BASE}{path}"))
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(REFERER, REFERER_VALUE)
        .header(COOKIE, cookie_header)
        .form(form)
        .send()
        .await?
        .error_for_status()?;
    Ok(res.json::<Value>().await?)
}

pub async fn search(keywords: &str, limit: u32, cookie: &str) -> Result<Vec<Song>, anyhow::Error> {
    let limit = limit.clamp(1, 100);
    let form = [
        ("s", keywords.to_string()),
        ("type", "1".to_string()),
        ("limit", limit.to_string()),
        ("offset", "0".to_string()),
    ];
    let data = post_json("/api/cloudsearch/get/web", &form, cookie).await?;
    let mut songs: Vec<Song> = data
        .pointer("/result/songs")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(song_from_value).collect())
        .unwrap_or_default();

    let missing_cover_ids = songs
        .iter()
        .filter(|song| song.cover.is_empty() && !song.id.is_empty())
        .map(|song| song.id.clone())
        .collect::<Vec<_>>();
    if !missing_cover_ids.is_empty() {
        if let Ok(details) = song_detail(&missing_cover_ids, cookie).await {
            let id_to_cover = details
                .into_iter()
                .filter(|song| !song.cover.is_empty())
                .map(|song| (song.id, song.cover))
                .collect::<std::collections::HashMap<_, _>>();
            for song in &mut songs {
                if song.cover.is_empty() {
                    if let Some(cover) = id_to_cover.get(&song.id) {
                        song.cover = cover.clone();
                    }
                }
            }
        }
    }

    Ok(songs)
}

pub async fn login_status(cookie: &str) -> Result<LoginInfo, anyhow::Error> {
    let data = get_json("/api/nuser/account/get", cookie).await?;
    let profile = data.get("profile").unwrap_or(&Value::Null);
    let account = data.get("account").unwrap_or(&Value::Null);
    let user_id = value_to_string(profile.get("userId").or_else(|| account.get("id")));
    let logged_in = !user_id.is_empty();
    let vip_type = as_u32(profile.get("vipType").or_else(|| account.get("vipType")));
    let vip_level = as_u32(profile.get("vipLevel").or_else(|| account.get("vipLevel")));
    Ok(LoginInfo {
        provider: "netease".into(),
        logged_in,
        user_id,
        nickname: as_string(profile.get("nickname")),
        avatar: as_string(profile.get("avatarUrl")),
        vip_type,
        vip_level,
        is_vip: vip_type.unwrap_or(0) > 0 || vip_level.unwrap_or(0) > 0,
        is_svip: vip_type.unwrap_or(0) >= 11,
    })
}

pub async fn user_playlists(uid: &str, cookie: &str) -> Result<Vec<Playlist>, anyhow::Error> {
    let path = format!(
        "/api/user/playlist/?offset=0&limit=1001&uid={}",
        urlencoding::encode(uid)
    );
    let data = get_json(&path, cookie).await?;
    Ok(data
        .get("playlist")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(playlist_from_value).collect())
        .unwrap_or_default())
}

pub async fn likelist(uid: &str, cookie_header: &str) -> Result<Vec<String>, anyhow::Error> {
    let path = format!(
        "/api/user/playlist/?offset=0&limit=1001&uid={}",
        urlencoding::encode(uid)
    );
    let data = get_json(&path, cookie_header).await?;
    let liked_playlist_id = data
        .get("playlist")
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find_map(|playlist| {
                let special_type = as_u32(playlist.get("specialType")).unwrap_or(0);
                (special_type == 5).then(|| value_to_string(playlist.get("id")))
            })
        })
        .filter(|id| !id.is_empty())
        .ok_or_else(|| anyhow::Error::msg("Liked playlist was not found"))?;

    let data = playlist_detail_raw(&liked_playlist_id, cookie_header).await?;
    Ok(track_ids_from_playlist(
        data.get("playlist").unwrap_or(&Value::Null),
    ))
}

pub async fn like(id: &str, like: bool, cookie_header: &str) -> Result<(), anyhow::Error> {
    let csrf = csrf_token(cookie_header);
    let form = [
        ("trackId", id.to_string()),
        ("like", like.to_string()),
        ("csrf_token", csrf),
    ];
    let data = post_json("/api/song/like", &form, cookie_header).await?;
    ensure_ok(&data, "Failed to update song like")
}

pub async fn playlist_subscribe(
    id: &str,
    subscribe: bool,
    cookie_header: &str,
) -> Result<(), anyhow::Error> {
    let csrf = csrf_token(cookie_header);
    let form = [("id", id.to_string()), ("csrf_token", csrf)];
    let path = if subscribe {
        "/api/playlist/subscribe"
    } else {
        "/api/playlist/unsubscribe"
    };
    let data = post_json(path, &form, cookie_header).await?;
    ensure_ok(&data, "Failed to update playlist subscription")
}

pub async fn recommend_songs(cookie: &str) -> Result<Vec<Song>, anyhow::Error> {
    let data = get_json("/api/v3/discovery/recommend/songs", cookie).await?;
    Ok(data
        .pointer("/data/dailySongs")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(song_from_value).collect())
        .unwrap_or_default())
}

pub async fn toplists(cookie: &str) -> Result<Vec<Playlist>, anyhow::Error> {
    let data = get_json("/api/toplist/detail", cookie).await?;
    Ok(data
        .get("list")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(playlist_from_value).collect())
        .unwrap_or_default())
}

pub async fn personalized_playlists(cookie: &str) -> Result<Vec<Playlist>, anyhow::Error> {
    let form = [
        ("limit", "30".to_string()),
        ("csrf_token", csrf_token(cookie)),
    ];
    let data = post_json("/api/personalized/playlist", &form, cookie).await?;
    Ok(data
        .get("result")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(playlist_from_value).collect())
        .unwrap_or_default())
}

pub async fn playlist_search(
    keywords: &str,
    limit: u32,
    cookie: &str,
) -> Result<Vec<Playlist>, anyhow::Error> {
    let limit = limit.clamp(1, 100);
    let form = [
        ("s", keywords.to_string()),
        ("type", "1000".to_string()),
        ("limit", limit.to_string()),
        ("offset", "0".to_string()),
    ];
    let data = post_json("/api/cloudsearch/get/web", &form, cookie).await?;
    Ok(data
        .pointer("/result/playlists")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(playlist_from_value).collect())
        .unwrap_or_default())
}

pub async fn album_search(
    keywords: &str,
    limit: u32,
    cookie: &str,
) -> Result<Vec<Album>, anyhow::Error> {
    let limit = limit.clamp(1, 100);
    let form = [
        ("s", keywords.to_string()),
        ("type", "10".to_string()),
        ("limit", limit.to_string()),
        ("offset", "0".to_string()),
    ];
    let data = post_json("/api/cloudsearch/get/web", &form, cookie).await?;
    Ok(data
        .pointer("/result/albums")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(album_from_value).collect())
        .unwrap_or_default())
}

pub async fn artist_search(
    keywords: &str,
    limit: u32,
    cookie: &str,
) -> Result<Vec<Artist>, anyhow::Error> {
    let limit = limit.clamp(1, 100);
    let form = [
        ("s", keywords.to_string()),
        ("type", "100".to_string()),
        ("limit", limit.to_string()),
        ("offset", "0".to_string()),
    ];
    let data = post_json("/api/cloudsearch/get/web", &form, cookie).await?;
    Ok(data
        .pointer("/result/artists")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(artist_from_value).collect())
        .unwrap_or_default())
}

pub async fn album_songs(id: &str, cookie: &str) -> Result<Vec<Song>, anyhow::Error> {
    let path = format!("/api/v1/album/{}", urlencoding::encode(id));
    let data = get_json(&path, cookie).await?;
    Ok(data
        .get("songs")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(song_from_value).collect())
        .unwrap_or_default())
}

pub async fn artist_songs(id: &str, cookie: &str) -> Result<Vec<Song>, anyhow::Error> {
    let path = format!("/api/v1/artist/{}", urlencoding::encode(id));
    let data = get_json(&path, cookie).await?;
    Ok(data
        .get("hotSongs")
        .or_else(|| data.get("songs"))
        .and_then(Value::as_array)
        .map(|items| items.iter().map(song_from_value).collect())
        .unwrap_or_default())
}

pub async fn playlist_tracks(
    id: &str,
    cookie: &str,
) -> Result<(Playlist, Vec<Song>), anyhow::Error> {
    let data = playlist_detail_raw(id, cookie).await?;
    let playlist = data.get("playlist").unwrap_or(&Value::Null);
    let meta = playlist_from_value(playlist);
    let songs: Vec<Song> = playlist
        .get("tracks")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(song_from_value).collect())
        .unwrap_or_default();
    if !songs.is_empty() {
        return Ok((meta, songs));
    }
    let ids = track_ids_from_playlist(playlist);
    let songs = song_detail(&ids.into_iter().take(100).collect::<Vec<_>>(), cookie).await?;
    Ok((meta, songs))
}

pub async fn playlist_tracks_range(
    id: &str,
    start: usize,
    count: usize,
    cookie: &str,
) -> Result<Vec<Song>, anyhow::Error> {
    let data = playlist_detail_raw(id, cookie).await?;
    let ids = track_ids_from_playlist(data.get("playlist").unwrap_or(&Value::Null));
    let selected = ids
        .into_iter()
        .skip(start)
        .take(count.min(200))
        .collect::<Vec<_>>();
    song_detail(&selected, cookie).await
}

pub async fn song_url(
    id: &str,
    preferred_quality: PlaybackQuality,
    cookie: &str,
) -> Result<SongUrlResult, anyhow::Error> {
    let mut last = SongUrlResult {
        playable: false,
        reason: Some("no_url".into()),
        message: Some("No playable URL returned by NetEase".into()),
        ..SongUrlResult::default()
    };

    for quality in preferred_quality.fallback_chain() {
        let level = quality.as_level();
        let data = song_url_v1_json(id, level, cookie).await?;
        let Some(item) = data
            .get("data")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
        else {
            continue;
        };
        last = song_url_from_value(item, level);
        if last.playable {
            return Ok(last);
        }
    }

    Ok(last)
}

pub async fn lyric(id: &str, cookie: &str) -> Result<Lyrics, anyhow::Error> {
    let path = format!(
        "/api/song/lyric?id={}&lv=1&kv=1&tv=-1",
        urlencoding::encode(id)
    );
    let data = get_json(&path, cookie).await?;
    Ok(Lyrics {
        lyric: as_string(data.pointer("/lrc/lyric")),
        translation: as_string(data.pointer("/tlyric/lyric")),
    })
}

async fn song_url_v1_json(id: &str, level: &str, cookie: &str) -> Result<Value, anyhow::Error> {
    let ids = format!("[{}]", id.trim());
    let cookie_header = request_cookie(cookie);
    let payload = json!({
        "ids": ids,
        "level": level,
        "encodeType": "flac",
    });

    match weapi::post_weapi(SONG_URL_V1_WEAPI, payload, Some(&cookie_header)).await {
        Ok(response) => Ok(response.json),
        Err(weapi_error) => {
            let form = [
                ("ids", ids),
                ("level", level.to_string()),
                ("encodeType", "flac".to_string()),
                ("csrf_token", csrf_token(&cookie_header)),
            ];
            post_json("/api/song/enhance/player/url/v1", &form, &cookie_header)
                .await
                .map_err(|api_error| {
                    anyhow::Error::msg(format!(
                        "song url request failed: weapi: {weapi_error}; api: {api_error}"
                    ))
                })
        }
    }
}

async fn playlist_detail_raw(id: &str, cookie: &str) -> Result<Value, anyhow::Error> {
    let form = [
        ("id", id.to_string()),
        ("n", "1000".to_string()),
        ("s", "8".to_string()),
    ];
    post_json("/api/v6/playlist/detail", &form, cookie).await
}

async fn song_detail(ids: &[String], cookie: &str) -> Result<Vec<Song>, anyhow::Error> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let c = ids.iter().map(|id| json!({ "id": id })).collect::<Vec<_>>();
    let path = format!(
        "/api/v3/song/detail?c={}",
        urlencoding::encode(&serde_json::to_string(&c)?)
    );
    let data = get_json(&path, cookie).await?;
    Ok(data
        .get("songs")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(song_from_value).collect())
        .unwrap_or_default())
}

fn song_from_value(value: &Value) -> Song {
    let artists = artists_from_value(value);
    let artist = artists
        .iter()
        .map(|a| a.name.as_str())
        .collect::<Vec<_>>()
        .join(" / ");
    let album = value
        .get("al")
        .or_else(|| value.get("album"))
        .unwrap_or(&Value::Null);
    Song {
        provider: "netease".into(),
        id: value_to_string(value.get("id")),
        name: as_string(value.get("name")),
        artist,
        artists,
        album: as_string(album.get("name")),
        cover: as_string(
            album
                .get("picUrl")
                .or_else(|| album.get("blurPicUrl"))
                .or_else(|| album.get("coverUrl")),
        ),
        duration: as_u64(value.get("dt").or_else(|| value.get("duration"))).unwrap_or(0),
        fee: as_u32(value.get("fee")),
        playable: value.get("noCopyrightRcmd").is_none(),
        language: value
            .get("alia")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
    }
}

fn artists_from_value(value: &Value) -> Vec<Artist> {
    value
        .get("ar")
        .or_else(|| value.get("artists"))
        .and_then(Value::as_array)
        .map(|items| items.iter().map(artist_from_value).collect())
        .unwrap_or_default()
}

fn artist_from_value(value: &Value) -> Artist {
    Artist {
        id: value_to_string(value.get("id")),
        name: as_string(value.get("name")),
        cover: as_string(
            value
                .get("picUrl")
                .or_else(|| value.get("img1v1Url"))
                .or_else(|| value.get("avatar")),
        ),
    }
}

fn album_from_value(value: &Value) -> Album {
    let artist = value
        .get("artist")
        .map(|item| as_string(item.get("name")))
        .filter(|name| !name.is_empty())
        .or_else(|| {
            value.get("artists").and_then(Value::as_array).map(|items| {
                items
                    .iter()
                    .map(|artist| as_string(artist.get("name")))
                    .filter(|name| !name.is_empty())
                    .collect::<Vec<_>>()
                    .join(" / ")
            })
        })
        .unwrap_or_default();
    Album {
        provider: "netease".into(),
        id: value_to_string(value.get("id")),
        name: as_string(value.get("name")),
        artist,
        cover: as_string(value.get("picUrl").or_else(|| value.get("blurPicUrl"))),
        song_count: as_u32(value.get("size").or_else(|| value.get("songCount"))).unwrap_or(0),
        publish_time: as_u64(value.get("publishTime")),
    }
}

fn playlist_from_value(value: &Value) -> Playlist {
    Playlist {
        provider: "netease".into(),
        id: value_to_string(value.get("id")),
        name: as_string(value.get("name")),
        cover: as_string(value.get("coverImgUrl").or_else(|| value.get("picUrl"))),
        track_count: as_u32(value.get("trackCount")).unwrap_or(0),
        creator: as_string(
            value
                .pointer("/creator/nickname")
                .or_else(|| value.get("copywriter")),
        ),
        subscribed: value
            .get("subscribed")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    }
}

fn track_ids_from_playlist(playlist: &Value) -> Vec<String> {
    playlist
        .get("trackIds")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let id = value_to_string(item.get("id"));
                    (!id.is_empty()).then_some(id)
                })
                .collect()
        })
        .unwrap_or_default()
}

fn song_url_from_value(value: &Value, requested_level: &str) -> SongUrlResult {
    let url = as_string(value.get("url"));
    let fee = as_u32(value.get("fee"));
    let trial = value.get("freeTrialInfo").is_some()
        || value
            .get("type")
            .and_then(Value::as_str)
            .map(|kind| kind.contains("trial"))
            .unwrap_or(false);
    let playable = !url.is_empty();
    SongUrlResult {
        url: playable.then_some(url),
        playable,
        trial,
        level: Some(as_string(value.get("level")).trim().to_string())
            .filter(|s| !s.is_empty())
            .or_else(|| Some(requested_level.into())),
        quality: Some(requested_level.into()),
        br: as_u32(value.get("br")),
        reason: (!playable).then(|| "no_url".into()),
        message: (!playable)
            .then(|| as_string(value.get("message")))
            .filter(|s| !s.is_empty())
            .or_else(|| (!playable).then(|| "No playable URL returned by NetEase".into())),
        fee,
    }
}

fn csrf_token(cookie_header: &str) -> String {
    cookie::parse_cookie_string(cookie_header)
        .get("__csrf")
        .cloned()
        .unwrap_or_default()
}

fn request_cookie(cookie_header: &str) -> String {
    cookie::normalize_cookie_header(&format!(
        "{}; {}",
        request_strategy_cookie(),
        cookie_header.trim()
    ))
}

fn request_strategy_cookie() -> &'static str {
    REQUEST_STRATEGY_COOKIE
        .get_or_init(|| {
            format!(
                "sDeviceId={}; os=pc; appver=8.9.70; __remember_me=true; NMTID={}",
                weapi::generate_s_device_id(),
                weapi::generate_s_device_id()
            )
        })
        .as_str()
}

fn ensure_ok(data: &Value, fallback: &str) -> Result<(), anyhow::Error> {
    let code = as_u32(data.get("code"));
    if matches!(code, Some(200) | Some(0)) {
        return Ok(());
    }
    let message = as_string(data.get("message").or_else(|| data.get("msg")));
    Err(anyhow::Error::msg(if message.is_empty() {
        fallback.to_string()
    } else {
        message
    }))
}

fn as_string(value: Option<&Value>) -> String {
    value
        .and_then(|v| match v {
            Value::String(s) => Some(s.clone()),
            Value::Number(n) => Some(n.to_string()),
            _ => None,
        })
        .unwrap_or_default()
}

fn value_to_string(value: Option<&Value>) -> String {
    as_string(value)
}

fn as_u32(value: Option<&Value>) -> Option<u32> {
    value.and_then(|v| v.as_u64().map(|n| n as u32))
}

fn as_u64(value: Option<&Value>) -> Option<u64> {
    value.and_then(Value::as_u64)
}
