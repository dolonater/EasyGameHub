use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::header::{
    ACCEPT_RANGES, ACCESS_CONTROL_ALLOW_ORIGIN, CACHE_CONTROL, CONTENT_LENGTH, CONTENT_RANGE,
    CONTENT_TYPE, RANGE,
};
use axum::http::Request as AxRequest;
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use url::Url;

use super::cache;
use super::playback;

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// 全局复用媒体转发客户端（连接池，参考 bili-rust stream.rs 全程单一客户端）。
/// 若上游 502，先看日志定位（已加 bilibili proxy upstream 错误日志），不要直接回滚。
static MEDIA_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn media_client() -> &'static reqwest::Client {
    MEDIA_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(BROWSER_UA)
            .connect_timeout(Duration::from_secs(5))
            .pool_idle_timeout(Duration::from_secs(120))
            .build()
            .expect("failed to build bilibili media client")
    })
}

#[derive(Debug, Clone, Copy)]
struct ProxyState {
    port: u16,
}

#[derive(Debug, Clone)]
struct HttpState {
    data_dir: PathBuf,
}

#[derive(Debug, Deserialize)]
struct CoverQuery {
    url: String,
}

static PROXY_STATE: OnceLock<Mutex<Option<ProxyState>>> = OnceLock::new();

pub async fn start_proxy(data_dir: PathBuf) -> Result<u16, anyhow::Error> {
    let lock = PROXY_STATE.get_or_init(|| Mutex::new(None));
    if let Some(state) = *lock.lock().unwrap() {
        return Ok(state.port);
    }
    // 弹幕 WS 桥需要工具目录（取登录态客户端避免 danmu_info 风控）
    super::live_bridge::init(data_dir.clone());

    let app = Router::new()
        .route(
            "/bilibili/dash/:playback_id/manifest.mpd",
            get(playback_manifest),
        )
        .route("/bilibili/media/:playback_id/:track_id", get(proxy_media))
        .route("/bilibili/cover/:cache_key", get(proxy_cover))
        .route(
            "/bilibili/live/:room_id/danmaku",
            get(super::live_bridge::live_danmaku_ws),
        )
        .route("/bilibili/live_stream/:key", get(proxy_live_stream))
        .with_state(HttpState { data_dir })
        // 统一 CORS：即使上游失败（502）也带 CORS 头，前端不再报跨域错误
        .layer(middleware::from_fn(cors_headers));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    *lock.lock().unwrap() = Some(ProxyState { port });

    tauri::async_runtime::spawn(async move {
        if let Err(error) = axum::serve(listener, app).await {
            log::error!("bilibili proxy failed: {error}");
        }
    });

    Ok(port)
}

/// 统一 CORS 响应头：所有代理响应（含错误）都放行浏览器跨域读取。
async fn cors_headers(request: AxRequest<Body>, next: Next) -> axum::response::Response {
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(ACCESS_CONTROL_ALLOW_ORIGIN, "*".parse().unwrap());
    response.headers_mut().insert(
        "access-control-expose-headers",
        "Content-Range, Content-Length, Accept-Ranges"
            .parse()
            .unwrap(),
    );
    response.headers_mut().insert(
        "access-control-allow-methods",
        "GET, HEAD, OPTIONS".parse().unwrap(),
    );
    response
}

pub fn get_proxy_port() -> Option<u16> {
    PROXY_STATE
        .get()
        .and_then(|lock| lock.lock().ok().and_then(|state| state.map(|s| s.port)))
}

async fn playback_manifest(
    Path(playback_id): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let session = playback::get_session(&playback_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "unknown playback session".to_string(),
        )
    })?;
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, "application/dash+xml")
        .header(CACHE_CONTROL, "no-store")
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .body(Body::from(playback::build_mpd(
            &session,
            get_proxy_port().unwrap_or_default(),
        )))
        .map_err(internal)
}

async fn proxy_media(
    Path((playback_id, track_id)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    let track = playback::get_track(&playback_id, &track_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "unknown playback track".to_string()))?;
    let mut urls = Vec::with_capacity(track.backup_urls.len() + 1);
    urls.push(track.base_url.clone());
    urls.extend(track.backup_urls.clone());

    let mut last_error = "upstream request failed".to_string();
    for raw_url in urls {
        if let Err((_, message)) = validate_remote_url(&raw_url) {
            last_error = message;
            continue;
        }
        match request_media(&raw_url, &track.mime_type, &headers).await {
            Ok(response) => return Ok(response),
            Err((_, message)) => last_error = message,
        }
    }

    Err((StatusCode::BAD_GATEWAY, last_error))
}

async fn proxy_cover(
    State(state): State<HttpState>,
    Path(cache_key): Path<String>,
    Query(query): Query<CoverQuery>,
) -> Result<Response, (StatusCode, String)> {
    validate_cover_url(&query.url)?;
    // 缓存是尽力而为层：读失败当 miss、写失败不阻断响应（Windows 上 WebView
    // 可能锁住旧封面文件导致清理/写入失败，降级保证封面始终可返回）
    if let Ok(Some((bytes, content_type))) = cache::load_cover(&state.data_dir, &cache_key) {
        return Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_TYPE, content_type)
            .header(CACHE_CONTROL, "public, max-age=604800")
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header("Cross-Origin-Resource-Policy", "cross-origin")
            .body(Body::from(bytes))
            .map_err(internal);
    }

    let response = request_cover(&query.url).await?;
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().await.map_err(internal)?;
    if let Err(error) = cache::save_cover(&state.data_dir, &cache_key, &content_type, &bytes) {
        log::warn!("bilibili cover cache save failed: {error}");
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, content_type)
        .header(CACHE_CONTROL, "public, max-age=604800")
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .body(Body::from(bytes))
        .map_err(internal)
}

async fn request_media(
    raw_url: &str,
    fallback_content_type: &str,
    headers: &HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    request_media_with_referer(
        raw_url,
        fallback_content_type,
        headers,
        "https://www.bilibili.com/",
    )
    .await
}

/// 转发媒体请求（带浏览器 UA 与指定 Referer，支持 Range 与 CORS 头）。
async fn request_media_with_referer(
    raw_url: &str,
    fallback_content_type: &str,
    headers: &HeaderMap,
    referer: &str,
) -> Result<Response, (StatusCode, String)> {
    // 全局复用客户端（连接池）：避免每个分段重新 TLS 握手拖慢起播（参考 bili-rust）
    let mut request = media_client()
        .get(raw_url)
        .header("Referer", referer)
        .header("User-Agent", BROWSER_UA);
    if let Some(range) = headers.get(RANGE) {
        request = request.header(RANGE, range);
    }

    let upstream = request.send().await.map_err(|err| {
        log::error!("bilibili proxy upstream request failed: {err} (url: {raw_url})");
        internal(err)
    })?;
    if !upstream.status().is_success() && upstream.status() != reqwest::StatusCode::PARTIAL_CONTENT
    {
        log::error!(
            "bilibili proxy upstream status {} (url: {})",
            upstream.status(),
            raw_url
        );
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("upstream status {}", upstream.status()),
        ));
    }

    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();
    let stream = upstream.bytes_stream();

    let mut builder = Response::builder().status(status);
    for name in [CONTENT_LENGTH, CONTENT_RANGE, ACCEPT_RANGES, CACHE_CONTROL] {
        if let Some(value) = upstream_headers.get(&name) {
            builder = builder.header(name, value);
        }
    }
    if let Some(value) = upstream_headers.get(CONTENT_TYPE) {
        builder = builder.header(CONTENT_TYPE, value);
    } else {
        builder = builder.header(CONTENT_TYPE, fallback_content_type);
    }
    builder = builder
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(ACCEPT_RANGES, "bytes")
        .header("Cross-Origin-Resource-Policy", "cross-origin");

    builder.body(Body::from_stream(stream)).map_err(internal)
}

/// 直播流代理：取登记过的 URL 后带直播 Referer 转发（浏览器无法直连 B 站直播 CDN）。
async fn proxy_live_stream(
    Path(key): Path<String>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    let url = super::live::take_stream_url(&key)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "unknown live stream".to_string()))?;
    request_media_with_referer(&url, "video/x-flv", &headers, "https://live.bilibili.com/").await
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

fn validate_cover_url(raw_url: &str) -> Result<(), (StatusCode, String)> {
    let url =
        Url::parse(raw_url).map_err(|_| (StatusCode::BAD_REQUEST, "invalid url".to_string()))?;
    match url.scheme() {
        "http" | "https" => {}
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                "unsupported url scheme".to_string(),
            ))
        }
    }
    let Some(host) = url.host_str() else {
        return Err((StatusCode::BAD_REQUEST, "missing url host".to_string()));
    };
    if host.ends_with("hdslb.com") || host.ends_with("bilibili.com") {
        return Ok(());
    }
    Err((
        StatusCode::BAD_REQUEST,
        "unsupported cover host".to_string(),
    ))
}

async fn request_cover(raw_url: &str) -> Result<reqwest::Response, (StatusCode, String)> {
    let upstream = media_client()
        .get(raw_url)
        .header("Referer", "https://www.bilibili.com/")
        .header("User-Agent", BROWSER_UA)
        .send()
        .await
        .map_err(internal)?;
    if !upstream.status().is_success() {
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("upstream status {}", upstream.status()),
        ));
    }
    let content_type = upstream
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !content_type.starts_with("image/") {
        return Err((StatusCode::BAD_GATEWAY, "upstream is not image".to_string()));
    }
    Ok(upstream)
}

fn internal(error: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::BAD_GATEWAY, error.to_string())
}
