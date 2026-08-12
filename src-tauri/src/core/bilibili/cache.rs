use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use bpi_rs::BpiError;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use super::models::BiliLocalProgress;

const CACHE_DIR: &str = "bilibili";
const LIGHT_CACHE_DIR: &str = "cache";
const DATA_CACHE_DIR: &str = "data";
const COVER_CACHE_DIR: &str = "covers";
const PROGRESS_FILE: &str = "progress.json";
const SCREENSHOT_DIR: &str = "screenshots";
const COVER_TTL_SECONDS: u64 = 7 * 24 * 60 * 60;
const COVER_MAX_BYTES: u64 = 200 * 1024 * 1024;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProgressStore {
    entries: Vec<BiliLocalProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheEntry<T> {
    expires_at: u64,
    data: T,
}

pub const SEARCH_TTL: Duration = Duration::from_secs(10 * 60);
pub const POPULAR_TTL: Duration = Duration::from_secs(10 * 60);
pub const FAVORITE_TTL: Duration = Duration::from_secs(5 * 60);
pub const HISTORY_TTL: Duration = Duration::from_secs(2 * 60);
pub const TOVIEW_TTL: Duration = Duration::from_secs(2 * 60);
pub const VIDEO_DETAIL_TTL: Duration = Duration::from_secs(5 * 60);
pub const COMMENT_TTL: Duration = Duration::from_secs(60);

pub fn load_json<T>(tool_dir: &Path, namespace: &str, key: &str) -> Result<Option<T>, BpiError>
where
    T: DeserializeOwned,
{
    let path = data_cache_path(tool_dir, namespace, key);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(io_error)?;
    let entry: CacheEntry<T> = match serde_json::from_slice(&bytes) {
        Ok(entry) => entry,
        Err(_) => {
            // 缓存是尽力而为层：文件损坏或结构不兼容（如收藏夹 items 缓存从数组升级为
            // 对象）时丢弃重建，而不是让调用方看到解析错误
            let _ = fs::remove_file(path);
            return Ok(None);
        }
    };
    if entry.expires_at <= now_unix() {
        let _ = fs::remove_file(path);
        return Ok(None);
    }
    Ok(Some(entry.data))
}

pub fn save_json<T>(
    tool_dir: &Path,
    namespace: &str,
    key: &str,
    ttl: Duration,
    data: &T,
) -> Result<(), BpiError>
where
    T: Serialize,
{
    let path = data_cache_path(tool_dir, namespace, key);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    let entry = CacheEntry {
        expires_at: now_unix().saturating_add(ttl.as_secs()),
        data,
    };
    let bytes = serde_json::to_vec_pretty(&entry)
        .map_err(|err| BpiError::parse(format!("failed to encode cache entry: {err}")))?;
    fs::write(path, bytes).map_err(io_error)
}

pub fn clear_cache(tool_dir: &Path) -> Result<usize, BpiError> {
    let dir = light_cache_dir(tool_dir);
    if !dir.exists() {
        return Ok(0);
    }
    let count = count_files(&dir).map_err(io_error)?;
    fs::remove_dir_all(&dir).map_err(io_error)?;
    Ok(count)
}

pub fn clear_namespace(tool_dir: &Path, namespace: &str) -> Result<usize, BpiError> {
    let dir = light_cache_dir(tool_dir)
        .join(DATA_CACHE_DIR)
        .join(sanitize_key(namespace));
    if !dir.exists() {
        return Ok(0);
    }
    let count = count_files(&dir).map_err(io_error)?;
    fs::remove_dir_all(&dir).map_err(io_error)?;
    Ok(count)
}

pub fn load_cover(tool_dir: &Path, key: &str) -> Result<Option<(Vec<u8>, String)>, BpiError> {
    let path = cover_path(tool_dir, key);
    if !path.exists() || is_expired(&path, Duration::from_secs(COVER_TTL_SECONDS))? {
        let _ = fs::remove_file(path);
        return Ok(None);
    }
    let content_type = content_type_from_extension(&path);
    let bytes = fs::read(&path).map_err(io_error)?;
    Ok(Some((bytes, content_type)))
}

pub fn save_cover(
    tool_dir: &Path,
    key: &str,
    content_type: &str,
    bytes: &[u8],
) -> Result<PathBuf, BpiError> {
    let dir = cover_cache_dir(tool_dir);
    fs::create_dir_all(&dir).map_err(io_error)?;
    let path = dir.join(format!(
        "{}.{}",
        sanitize_key(key),
        cover_extension(content_type)
    ));
    fs::write(&path, bytes).map_err(io_error)?;
    enforce_cover_limit(&dir, COVER_MAX_BYTES)?;
    Ok(path)
}

pub fn save_local_progress(
    tool_dir: &Path,
    bvid: String,
    aid: u64,
    cid: u64,
    progress_seconds: u64,
) -> Result<BiliLocalProgress, BpiError> {
    if bvid.trim().is_empty() {
        return Err(BpiError::invalid_parameter("bvid", "id must be non-empty"));
    }
    if cid == 0 {
        return Err(BpiError::invalid_parameter("cid", "id must be non-zero"));
    }

    let next = BiliLocalProgress {
        bvid: bvid.trim().to_string(),
        aid,
        cid,
        progress_seconds,
        updated_at: now_unix(),
    };
    let mut store = load_store(tool_dir)?;
    store
        .entries
        .retain(|entry| !(entry.bvid == next.bvid && entry.cid == next.cid));
    store.entries.push(next.clone());
    store.entries.sort_by(|a, b| {
        a.bvid
            .cmp(&b.bvid)
            .then_with(|| a.cid.cmp(&b.cid))
            .then_with(|| a.updated_at.cmp(&b.updated_at))
    });
    save_store(tool_dir, &store)?;
    Ok(next)
}

pub fn load_local_progress(
    tool_dir: &Path,
    bvid: &str,
    cid: Option<u64>,
) -> Result<Option<BiliLocalProgress>, BpiError> {
    if bvid.trim().is_empty() {
        return Ok(None);
    }

    let store = load_store(tool_dir)?;
    Ok(store
        .entries
        .into_iter()
        .filter(|entry| {
            entry.bvid == bvid && cid.map_or(true, |target_cid| entry.cid == target_cid)
        })
        .max_by_key(|entry| entry.updated_at))
}

pub fn save_screenshot(
    tool_dir: &Path,
    file_name: &str,
    data_base64: &str,
) -> Result<PathBuf, BpiError> {
    let bytes = BASE64
        .decode(strip_data_url_prefix(data_base64))
        .map_err(|err| BpiError::parse(format!("invalid screenshot base64: {err}")))?;
    if bytes.is_empty() {
        return Err(BpiError::invalid_parameter(
            "dataBase64",
            "image data must be non-empty",
        ));
    }

    let dir = screenshots_dir(tool_dir);
    fs::create_dir_all(&dir).map_err(io_error)?;
    let path = dir.join(sanitize_png_name(file_name));
    fs::write(&path, bytes).map_err(io_error)?;
    Ok(path)
}

pub fn screenshots_dir(tool_dir: &Path) -> PathBuf {
    tool_dir.join(CACHE_DIR).join(SCREENSHOT_DIR)
}

fn load_store(tool_dir: &Path) -> Result<ProgressStore, BpiError> {
    let path = progress_path(tool_dir);
    if !path.exists() {
        return Ok(ProgressStore::default());
    }
    let bytes = fs::read(&path).map_err(io_error)?;
    serde_json::from_slice(&bytes)
        .map_err(|err| BpiError::parse(format!("invalid progress store: {err}")))
}

fn save_store(tool_dir: &Path, store: &ProgressStore) -> Result<(), BpiError> {
    let path = progress_path(tool_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    let bytes = serde_json::to_vec_pretty(store)
        .map_err(|err| BpiError::parse(format!("failed to encode progress store: {err}")))?;
    fs::write(path, bytes).map_err(io_error)
}

fn progress_path(tool_dir: &Path) -> PathBuf {
    tool_dir.join(CACHE_DIR).join(PROGRESS_FILE)
}

fn light_cache_dir(tool_dir: &Path) -> PathBuf {
    tool_dir.join(CACHE_DIR).join(LIGHT_CACHE_DIR)
}

fn data_cache_path(tool_dir: &Path, namespace: &str, key: &str) -> PathBuf {
    light_cache_dir(tool_dir)
        .join(DATA_CACHE_DIR)
        .join(sanitize_key(namespace))
        .join(format!("{}.json", stable_key(key)))
}

fn cover_cache_dir(tool_dir: &Path) -> PathBuf {
    light_cache_dir(tool_dir).join(COVER_CACHE_DIR)
}

fn cover_path(tool_dir: &Path, key: &str) -> PathBuf {
    let dir = cover_cache_dir(tool_dir);
    let key = sanitize_key(key);
    for extension in ["jpg", "png", "webp", "gif", "bin"] {
        let path = dir.join(format!("{key}.{extension}"));
        if path.exists() {
            return path;
        }
    }
    dir.join(format!("{key}.bin"))
}

fn strip_data_url_prefix(value: &str) -> &str {
    value.split_once(',').map_or(value, |(_, payload)| payload)
}

fn sanitize_png_name(file_name: &str) -> String {
    let stem: String = file_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = stem.trim_matches('.').trim_matches('_');
    let base = if trimmed.is_empty() {
        "bilibili-shot"
    } else {
        trimmed
    };
    if base.to_ascii_lowercase().ends_with(".png") {
        base.to_string()
    } else {
        format!("{base}.png")
    }
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn is_expired(path: &Path, ttl: Duration) -> Result<bool, BpiError> {
    let modified = fs::metadata(path)
        .map_err(io_error)?
        .modified()
        .map_err(io_error)?;
    Ok(modified.elapsed().unwrap_or(Duration::ZERO) > ttl)
}

fn count_files(dir: &Path) -> Result<usize, std::io::Error> {
    let mut count = 0;
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            count += count_files(&path)?;
        } else {
            count += 1;
        }
    }
    Ok(count)
}

fn enforce_cover_limit(dir: &Path, max_bytes: u64) -> Result<(), BpiError> {
    let mut files = cover_files(dir)?;
    let mut total: u64 = files.iter().map(|(_, size, _)| *size).sum();
    files.sort_by_key(|(_, _, modified)| *modified);
    for (path, size, _) in files {
        if total <= max_bytes {
            break;
        }
        fs::remove_file(path).map_err(io_error)?;
        total = total.saturating_sub(size);
    }
    Ok(())
}

fn cover_files(dir: &Path) -> Result<Vec<(PathBuf, u64, SystemTime)>, BpiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        let metadata = entry.metadata().map_err(io_error)?;
        if metadata.is_file() {
            files.push((
                entry.path(),
                metadata.len(),
                metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH),
            ));
        }
    }
    Ok(files)
}

fn stable_key(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn sanitize_key(value: &str) -> String {
    let key: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    if key.is_empty() {
        "default".to_string()
    } else {
        key
    }
}

fn cover_extension(content_type: &str) -> &'static str {
    match content_type.split(';').next().unwrap_or_default().trim() {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "bin",
    }
}

fn content_type_from_extension(path: &Path) -> String {
    match path.extension().and_then(|value| value.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn io_error(error: std::io::Error) -> BpiError {
    BpiError::parse(format!("bilibili cache io error: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_and_load_local_progress_by_cid() -> Result<(), BpiError> {
        let dir = tempdir("progress-by-cid");
        save_local_progress(&dir, "BV1xx411c7mD".to_string(), 42, 100, 12)?;
        save_local_progress(&dir, "BV1xx411c7mD".to_string(), 42, 101, 34)?;

        let first = load_local_progress(&dir, "BV1xx411c7mD", Some(100))?.unwrap();
        let second = load_local_progress(&dir, "BV1xx411c7mD", Some(101))?.unwrap();

        assert_eq!(first.progress_seconds, 12);
        assert_eq!(second.progress_seconds, 34);
        Ok(())
    }

    #[test]
    fn save_local_progress_overwrites_same_video_page() -> Result<(), BpiError> {
        let dir = tempdir("progress-overwrite");
        save_local_progress(&dir, "BV1xx411c7mD".to_string(), 42, 100, 12)?;
        save_local_progress(&dir, "BV1xx411c7mD".to_string(), 42, 100, 56)?;

        let progress = load_local_progress(&dir, "BV1xx411c7mD", Some(100))?.unwrap();

        assert_eq!(progress.progress_seconds, 56);
        assert_eq!(load_store(&dir)?.entries.len(), 1);
        Ok(())
    }

    #[test]
    fn save_screenshot_strips_data_url_and_sanitizes_file_name() -> Result<(), BpiError> {
        let dir = tempdir("screenshot");
        let path = save_screenshot(&dir, "../BV1/100.png", "data:image/png;base64,aGVsbG8=")?;

        assert_eq!(
            path.file_name().and_then(|value| value.to_str()),
            Some("BV1_100.png")
        );
        assert_eq!(fs::read(path).map_err(io_error)?, b"hello");
        Ok(())
    }

    #[test]
    fn corrupt_cache_entry_is_discarded_not_errored() -> Result<(), BpiError> {
        let dir = tempdir("corrupt-cache");
        let namespace = "favorite-items";
        let key = "mid:1:1";
        let path = data_cache_path(&dir, namespace, key);
        fs::create_dir_all(path.parent().unwrap()).map_err(io_error)?;
        // 旧版数组格式的缓存（新版期望对象）：应被丢弃并重建，而非报错
        fs::write(&path, r#"{"expiresAt": 9999999999, "data": []}"#).map_err(io_error)?;

        let cached: Option<super::super::models::BiliFavoritePage> =
            load_json(&dir, namespace, key)?;

        assert!(cached.is_none());
        assert!(!path.exists());
        Ok(())
    }

    #[test]
    fn expired_cache_entry_is_not_returned() -> Result<(), BpiError> {
        let dir = tempdir("expired-cache");
        save_json(
            &dir,
            "search",
            "rust",
            Duration::from_secs(0),
            &vec!["stale"],
        )?;

        let cached: Option<Vec<String>> = load_json(&dir, "search", "rust")?;

        assert!(cached.is_none());
        Ok(())
    }

    #[test]
    fn clear_cache_removes_light_cache_files() -> Result<(), BpiError> {
        let dir = tempdir("clear-cache");
        save_json(
            &dir,
            "search",
            "rust",
            Duration::from_secs(60),
            &vec!["fresh"],
        )?;
        save_cover(&dir, "cover", "image/png", b"png")?;

        let removed = clear_cache(&dir)?;

        assert_eq!(removed, 2);
        assert!(!light_cache_dir(&dir).exists());
        Ok(())
    }

    #[test]
    fn cover_cache_prunes_old_files_over_limit() -> Result<(), BpiError> {
        let dir = tempdir("cover-limit");
        let cover_dir = cover_cache_dir(&dir);
        fs::create_dir_all(&cover_dir).map_err(io_error)?;
        fs::write(cover_dir.join("old.png"), vec![1; 8]).map_err(io_error)?;
        fs::write(cover_dir.join("new.png"), vec![2; 8]).map_err(io_error)?;

        enforce_cover_limit(&cover_dir, 8)?;

        assert_eq!(cover_files(&cover_dir)?.len(), 1);
        Ok(())
    }

    fn tempdir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "easygamehub-bilibili-cache-{label}-{}-{nanos}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }
}
