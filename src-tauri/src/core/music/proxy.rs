use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::header::{
    ACCEPT_RANGES, ACCESS_CONTROL_ALLOW_ORIGIN, CACHE_CONTROL, CONTENT_LENGTH, CONTENT_RANGE,
    CONTENT_TYPE, RANGE,
};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use url::Url;

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const COVER_CACHE_DIR: &str = "music-cover-cache";
const COVER_CACHE_CONTROL_VALUE: &str = "public, max-age=604800, immutable";
const MAX_COVER_CACHE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, Copy)]
struct ProxyState {
    port: u16,
}

#[derive(Clone)]
struct ProxyAppState {
    cover_cache_dir: PathBuf,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct CoverCacheMeta {
    content_type: String,
    cached_at: u64,
}

static PROXY_STATE: OnceLock<Mutex<Option<ProxyState>>> = OnceLock::new();

pub async fn start_proxy(data_dir: PathBuf) -> Result<u16, anyhow::Error> {
    let lock = PROXY_STATE.get_or_init(|| Mutex::new(None));
    if let Some(state) = *lock.lock().unwrap() {
        return Ok(state.port);
    }

    let app_state = ProxyAppState {
        cover_cache_dir: data_dir.join(COVER_CACHE_DIR),
    };
    let app = Router::new()
        .route("/audio", get(proxy_audio))
        .route("/cover", get(proxy_cover))
        .with_state(app_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    *lock.lock().unwrap() = Some(ProxyState { port });

    tauri::async_runtime::spawn(async move {
        if let Err(error) = axum::serve(listener, app).await {
            log::error!("music proxy failed: {error}");
        }
    });

    Ok(port)
}

pub fn get_proxy_port() -> Option<u16> {
    PROXY_STATE
        .get()
        .and_then(|lock| lock.lock().ok().and_then(|state| state.map(|s| s.port)))
}

async fn proxy_audio(
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    proxy_remote(params, headers, true).await
}

async fn proxy_cover(
    State(state): State<ProxyAppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, (StatusCode, String)> {
    proxy_cover_with_cache(state, params).await
}

async fn proxy_remote(
    params: HashMap<String, String>,
    headers: HeaderMap,
    forward_range: bool,
) -> Result<Response, (StatusCode, String)> {
    let raw_url = params
        .get("url")
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "missing url".to_string()))?;
    validate_remote_url(raw_url)?;

    let client = reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .build()
        .map_err(internal)?;
    let mut request = client
        .get(raw_url)
        .header("Referer", "https://music.163.com/")
        .header("User-Agent", BROWSER_UA);
    if forward_range {
        if let Some(range) = headers.get(RANGE) {
            request = request.header(RANGE, range);
        }
    }
    let upstream = request.send().await.map_err(internal)?;
    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();
    let stream = upstream.bytes_stream();

    let mut builder = Response::builder().status(status);
    for name in [CONTENT_LENGTH, CONTENT_RANGE, ACCEPT_RANGES, CACHE_CONTROL] {
        if let Some(value) = upstream_headers.get(&name) {
            builder = builder.header(name, value);
        }
    }
    builder = if forward_range {
        builder.header(CONTENT_TYPE, audio_content_type_for(raw_url))
    } else if let Some(value) = upstream_headers.get(&CONTENT_TYPE) {
        builder.header(CONTENT_TYPE, value)
    } else {
        builder.header(CONTENT_TYPE, "image/jpeg")
    };
    builder = builder
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(ACCEPT_RANGES, "bytes")
        .header("Cross-Origin-Resource-Policy", "cross-origin");

    builder.body(Body::from_stream(stream)).map_err(internal)
}

async fn proxy_cover_with_cache(
    state: ProxyAppState,
    params: HashMap<String, String>,
) -> Result<Response, (StatusCode, String)> {
    let raw_url = params
        .get("url")
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "missing url".to_string()))?;
    validate_remote_url(raw_url)?;

    if let Some(response) = read_cover_cache(&state.cover_cache_dir, raw_url)? {
        return Ok(response);
    }

    let client = reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .build()
        .map_err(internal)?;
    let upstream = client
        .get(raw_url)
        .header("Referer", "https://music.163.com/")
        .header("User-Agent", BROWSER_UA)
        .send()
        .await
        .map_err(internal)?;
    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();
    let content_type = upstream_headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .filter(|value| value.starts_with("image/"))
        .map(str::to_string)
        .unwrap_or_else(|| image_content_type_for(raw_url).to_string());
    let bytes = upstream.bytes().await.map_err(internal)?;

    if status.is_success() && bytes.len() <= MAX_COVER_CACHE_BYTES {
        let _ = write_cover_cache(&state.cover_cache_dir, raw_url, &content_type, &bytes);
    }

    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, content_type)
        .header(CONTENT_LENGTH, bytes.len().to_string())
        .header(CACHE_CONTROL, COVER_CACHE_CONTROL_VALUE)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .body(Body::from(bytes))
        .map_err(internal)
}

fn read_cover_cache(
    cache_dir: &Path,
    raw_url: &str,
) -> Result<Option<Response>, (StatusCode, String)> {
    let file = cover_cache_file(cache_dir, raw_url);
    if !file.exists() {
        return Ok(None);
    }

    let bytes = match std::fs::read(&file) {
        Ok(bytes) => bytes,
        Err(_) => return Ok(None),
    };
    let content_type = read_cover_cache_meta(cache_dir, raw_url)
        .map(|meta| meta.content_type)
        .unwrap_or_else(|| image_content_type_for(raw_url).to_string());

    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, content_type)
        .header(CONTENT_LENGTH, bytes.len().to_string())
        .header(CACHE_CONTROL, COVER_CACHE_CONTROL_VALUE)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .body(Body::from(bytes))
        .map(Some)
        .map_err(internal)
}

fn write_cover_cache(
    cache_dir: &Path,
    raw_url: &str,
    content_type: &str,
    bytes: &[u8],
) -> Result<(), anyhow::Error> {
    std::fs::create_dir_all(cache_dir)?;
    let file = cover_cache_file(cache_dir, raw_url);
    let tmp = file.with_extension(format!(
        "tmp-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default()
    ));
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(tmp, file)?;

    let meta = CoverCacheMeta {
        content_type: content_type.to_string(),
        cached_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default(),
    };
    std::fs::write(
        cover_cache_meta_file(cache_dir, raw_url),
        serde_json::to_vec(&meta)?,
    )?;
    Ok(())
}

fn read_cover_cache_meta(cache_dir: &Path, raw_url: &str) -> Option<CoverCacheMeta> {
    let data = std::fs::read(cover_cache_meta_file(cache_dir, raw_url)).ok()?;
    serde_json::from_slice(&data).ok()
}

pub fn clear_cover_cache(data_dir: PathBuf) -> Result<usize, anyhow::Error> {
    let cache_dir = data_dir.join(COVER_CACHE_DIR);
    if !cache_dir.exists() {
        return Ok(0);
    }
    let mut removed = 0;
    for entry in std::fs::read_dir(cache_dir)? {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            std::fs::remove_file(entry.path())?;
            removed += 1;
        }
    }
    Ok(removed)
}

fn cover_cache_file(cache_dir: &Path, raw_url: &str) -> PathBuf {
    cache_dir.join(format!("{}.img", stable_cache_key(raw_url)))
}

fn cover_cache_meta_file(cache_dir: &Path, raw_url: &str) -> PathBuf {
    cache_dir.join(format!("{}.json", stable_cache_key(raw_url)))
}

fn stable_cache_key(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn validate_remote_url(raw_url: &str) -> Result<(), (StatusCode, String)> {
    let url =
        Url::parse(raw_url).map_err(|_| (StatusCode::BAD_REQUEST, "invalid url".to_string()))?;
    match url.scheme() {
        "http" | "https" => Ok(()),
        _ => Err((
            StatusCode::BAD_REQUEST,
            "unsupported url scheme".to_string(),
        )),
    }
}

fn audio_content_type_for(raw_url: &str) -> &'static str {
    let lower = raw_url.to_ascii_lowercase();
    if lower.contains(".flac") {
        "audio/flac"
    } else if lower.contains(".m4a") || lower.contains(".mp4") {
        "audio/mp4"
    } else if lower.contains(".ogg") {
        "audio/ogg"
    } else if lower.contains(".wav") {
        "audio/wav"
    } else {
        "audio/mpeg"
    }
}

fn image_content_type_for(raw_url: &str) -> &'static str {
    let lower = raw_url.to_ascii_lowercase();
    if lower.contains(".png") {
        "image/png"
    } else if lower.contains(".webp") {
        "image/webp"
    } else if lower.contains(".gif") {
        "image/gif"
    } else {
        "image/jpeg"
    }
}

fn internal(error: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::BAD_GATEWAY, error.to_string())
}

#[allow(dead_code)]
pub fn audio_proxy_url(raw_url: &str, port: u16) -> Result<String, anyhow::Error> {
    validate_remote_url(raw_url).map_err(|(_, message)| anyhow::Error::msg(message))?;
    Ok(format!(
        "http://127.0.0.1:{port}/audio?url={}",
        urlencoding::encode(raw_url)
    ))
}

#[allow(dead_code)]
pub fn cover_proxy_url(raw_url: &str, port: u16) -> Result<String, anyhow::Error> {
    validate_remote_url(raw_url).map_err(|(_, message)| anyhow::Error::msg(message))?;
    Ok(format!(
        "http://127.0.0.1:{port}/cover?url={}",
        urlencoding::encode(raw_url)
    ))
}
