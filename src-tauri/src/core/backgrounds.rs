use crate::core::config::{AppearanceSettings, BackgroundAsset};
use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const THUMBNAIL_MAX_EDGE: u32 = 256;
const THUMBNAIL_EXT: &str = "png";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheManifest {
    #[serde(default)]
    source_path: String,
    current_file: String,
}

pub fn sync_background_assets(
    thumbnail_root: &Path,
    runtime_root: &Path,
    appearance: &mut AppearanceSettings,
) -> Result<bool, anyhow::Error> {
    let source_lookup = build_cache_lookup(thumbnail_root, runtime_root, appearance)?;
    let canonicalize = |value: &str| -> String {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return String::new();
        }
        source_lookup
            .get(trimmed)
            .cloned()
            .unwrap_or_else(|| trimmed.to_string())
    };

    let mut ordered_sources: Vec<String> = Vec::new();
    let mut push_unique = |value: &str| {
        let canonical = canonicalize(value);
        if canonical.is_empty() {
            return;
        }
        if ordered_sources.iter().any(|item| item == &canonical) {
            return;
        }
        ordered_sources.push(canonical);
    };

    let previous_background_image = appearance.background_image.clone();
    let current_background = appearance
        .background_image
        .clone()
        .map(|current| canonicalize(&current))
        .filter(|current| !current.is_empty());
    if appearance.background_choice == "%custom" {
        appearance.background_image = current_background.clone();
    }

    for asset in &appearance.custom_background_assets {
        push_unique(&asset.source_path);
    }
    for source_path in &appearance.custom_backgrounds {
        push_unique(source_path);
    }
    if let Some(current) = current_background {
        if !ordered_sources.iter().any(|item| item == &current) {
            ordered_sources.push(current);
        }
    }

    let mut next_assets: Vec<BackgroundAsset> = Vec::with_capacity(ordered_sources.len());
    for source_path in &ordered_sources {
        let thumbnail_path = ensure_background_thumbnail(thumbnail_root, Path::new(source_path))?
            .map(|path| path.to_string_lossy().to_string());
        let runtime_path = ensure_background_runtime_copy(runtime_root, Path::new(source_path))?
            .map(|path| path.to_string_lossy().to_string());
        next_assets.push(BackgroundAsset {
            source_path: source_path.clone(),
            thumbnail_path,
            runtime_path,
        });
    }

    let changed = appearance.background_image != previous_background_image
        || appearance.custom_backgrounds != ordered_sources
        || appearance.custom_background_assets != next_assets;

    appearance.custom_backgrounds = ordered_sources;
    appearance.custom_background_assets = next_assets;

    Ok(changed)
}

pub fn ensure_background_thumbnail(
    cache_root: &Path,
    source_path: &Path,
) -> Result<Option<PathBuf>, anyhow::Error> {
    fs::create_dir_all(cache_root)?;

    let current_file = cache_filename(source_path, THUMBNAIL_EXT)?;
    let cache_path = cache_root.join(&current_file);
    let manifest_path = cache_root.join(format!(
        "{}.json",
        hash_bytes(source_path.to_string_lossy().as_bytes())
    ));

    if !source_path.exists() {
        return Ok(load_manifest(&manifest_path).and_then(|manifest| {
            let cached = cache_root.join(manifest.current_file);
            if cached.exists() {
                Some(cached)
            } else {
                None
            }
        }));
    }

    if cache_path.exists() {
        write_manifest(&manifest_path, source_path, &current_file)?;
        return Ok(Some(cache_path));
    }

    let previous_file = load_manifest(&manifest_path).map(|manifest| manifest.current_file);
    generate_thumbnail(source_path, &cache_path)?;

    if let Some(previous_file) = previous_file.filter(|previous| previous != &current_file) {
        let previous_path = cache_root.join(previous_file);
        let _ = fs::remove_file(previous_path);
    }

    write_manifest(&manifest_path, source_path, &current_file)?;
    Ok(Some(cache_path))
}

pub fn ensure_background_runtime_copy(
    cache_root: &Path,
    source_path: &Path,
) -> Result<Option<PathBuf>, anyhow::Error> {
    fs::create_dir_all(cache_root)?;

    let ext = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .filter(|ext| !ext.is_empty())
        .unwrap_or_else(|| "img".to_string());
    let current_file = cache_filename(source_path, &ext)?;
    let cache_path = cache_root.join(&current_file);
    let manifest_path = cache_root.join(format!(
        "{}.json",
        hash_bytes(source_path.to_string_lossy().as_bytes())
    ));

    if !source_path.exists() {
        return Ok(load_manifest(&manifest_path).and_then(|manifest| {
            let cached = cache_root.join(manifest.current_file);
            if cached.exists() {
                Some(cached)
            } else {
                None
            }
        }));
    }

    if cache_path.exists() {
        write_manifest(&manifest_path, source_path, &current_file)?;
        return Ok(Some(cache_path));
    }

    let previous_file = load_manifest(&manifest_path).map(|manifest| manifest.current_file);
    fs::copy(source_path, &cache_path)?;

    if let Some(previous_file) = previous_file.filter(|previous| previous != &current_file) {
        let previous_path = cache_root.join(previous_file);
        let _ = fs::remove_file(previous_path);
    }

    write_manifest(&manifest_path, source_path, &current_file)?;
    Ok(Some(cache_path))
}

fn cache_filename(source_path: &Path, ext: &str) -> Result<String, anyhow::Error> {
    let source_key = hash_bytes(source_path.to_string_lossy().as_bytes());
    let metadata = fs::metadata(source_path)?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| format!("{}-{}", duration.as_secs(), duration.subsec_nanos()))
        .unwrap_or_else(|| "0-0".to_string());
    let fingerprint = hash_bytes(
        format!(
            "{}:{}:{}",
            metadata.len(),
            modified,
            source_path.to_string_lossy()
        )
        .as_bytes(),
    );
    Ok(format!("{source_key:016x}-{fingerprint:016x}.{ext}"))
}

fn generate_thumbnail(source_path: &Path, cache_path: &Path) -> Result<(), anyhow::Error> {
    let image = image::open(source_path)?;
    let thumbnail = image.thumbnail(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE);
    thumbnail.save_with_format(cache_path, ImageFormat::Png)?;
    Ok(())
}

fn hash_bytes(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn build_cache_lookup(
    thumbnail_root: &Path,
    runtime_root: &Path,
    appearance: &AppearanceSettings,
) -> Result<HashMap<String, String>, anyhow::Error> {
    let mut map = HashMap::new();

    for asset in &appearance.custom_background_assets {
        let source_path = asset.source_path.trim();
        if source_path.is_empty() {
            continue;
        }
        if let Some(thumbnail_path) = asset
            .thumbnail_path
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            map.insert(thumbnail_path.to_string(), source_path.to_string());
        }
        if let Some(runtime_path) = asset
            .runtime_path
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            map.insert(runtime_path.to_string(), source_path.to_string());
        }
    }

    read_manifest_lookup(thumbnail_root, &mut map)?;
    read_manifest_lookup(runtime_root, &mut map)?;

    Ok(map)
}

fn read_manifest_lookup(
    cache_root: &Path,
    map: &mut HashMap<String, String>,
) -> Result<(), anyhow::Error> {
    if !cache_root.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(cache_root)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        if let Some(manifest) = load_manifest(&path) {
            if manifest.source_path.trim().is_empty() {
                continue;
            }
            let cache_path = cache_root.join(manifest.current_file);
            map.insert(
                cache_path.to_string_lossy().to_string(),
                manifest.source_path,
            );
        }
    }

    Ok(())
}

fn load_manifest(path: &Path) -> Option<CacheManifest> {
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn write_manifest(
    path: &Path,
    source_path: &Path,
    current_file: &str,
) -> Result<(), anyhow::Error> {
    let manifest = CacheManifest {
        source_path: source_path.to_string_lossy().to_string(),
        current_file: current_file.to_string(),
    };
    fs::write(path, serde_json::to_string_pretty(&manifest)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    fn write_test_image(path: &Path, width: u32, height: u32, color: [u8; 4]) {
        let image: ImageBuffer<Rgba<u8>, Vec<u8>> =
            ImageBuffer::from_pixel(width, height, Rgba(color));
        image.save(path).unwrap();
    }

    #[test]
    fn creates_and_reuses_thumbnail_cache() {
        let temp = tempfile::tempdir().unwrap();
        let cache_root = temp.path().join("cache");
        let source = temp.path().join("background.png");
        write_test_image(&source, 640, 360, [255, 0, 0, 255]);

        let thumb1 = ensure_background_thumbnail(&cache_root, &source)
            .unwrap()
            .unwrap();
        assert!(thumb1.exists());

        let generated = image::open(&thumb1).unwrap();
        assert!(generated.width() <= THUMBNAIL_MAX_EDGE);
        assert!(generated.height() <= THUMBNAIL_MAX_EDGE);

        let thumb2 = ensure_background_thumbnail(&cache_root, &source)
            .unwrap()
            .unwrap();
        assert_eq!(thumb1, thumb2);
    }

    #[test]
    fn creates_runtime_background_copy() {
        let temp = tempfile::tempdir().unwrap();
        let cache_root = temp.path().join("runtime");
        let source = temp.path().join("background.png");
        write_test_image(&source, 640, 360, [0, 255, 0, 255]);

        let runtime = ensure_background_runtime_copy(&cache_root, &source)
            .unwrap()
            .unwrap();
        assert!(runtime.exists());
        let copied = image::open(&runtime).unwrap();
        assert_eq!(copied.width(), 640);
        assert_eq!(copied.height(), 360);
    }

    #[test]
    fn canonicalizes_thumbnail_background_back_to_source_path() {
        let temp = tempfile::tempdir().unwrap();
        let thumbnail_root = temp.path().join("thumbs");
        let runtime_root = temp.path().join("runtime");
        let source = temp.path().join("background.png");
        write_test_image(&source, 640, 360, [255, 0, 0, 255]);

        let thumb = ensure_background_thumbnail(&thumbnail_root, &source)
            .unwrap()
            .unwrap();
        let runtime = ensure_background_runtime_copy(&runtime_root, &source)
            .unwrap()
            .unwrap();
        let mut appearance = AppearanceSettings {
            preset: "custom".to_string(),
            background_image: Some(thumb.to_string_lossy().to_string()),
            background_choice: "%custom".to_string(),
            custom_backgrounds: vec![],
            custom_background_assets: vec![BackgroundAsset {
                source_path: source.to_string_lossy().to_string(),
                thumbnail_path: Some(thumb.to_string_lossy().to_string()),
                runtime_path: Some(runtime.to_string_lossy().to_string()),
            }],
            follow_background_text: false,
            use_liquid_glass: false,
            auto_darken: true,
            overlay_opacity: 0.35,
            background_blur: 0.0,
            surface_opacity: 1.0,
            surface_blur: 0.0,
            radius: 8.0,
            font_family: "%built-in".to_string(),
        };

        let changed =
            sync_background_assets(&thumbnail_root, &runtime_root, &mut appearance).unwrap();
        assert!(changed);
        assert_eq!(
            appearance.background_image.as_deref(),
            Some(source.to_string_lossy().as_ref())
        );
        assert_eq!(
            appearance.custom_backgrounds,
            vec![source.to_string_lossy().to_string()]
        );
        assert_eq!(appearance.custom_background_assets.len(), 1);
        assert_eq!(
            appearance.custom_background_assets[0].source_path,
            source.to_string_lossy()
        );
        assert_eq!(
            appearance.custom_background_assets[0]
                .thumbnail_path
                .as_deref(),
            Some(thumb.to_string_lossy().as_ref())
        );
        assert_eq!(
            appearance.custom_background_assets[0]
                .runtime_path
                .as_deref(),
            Some(runtime.to_string_lossy().as_ref())
        );
    }

    #[test]
    fn regenerates_when_source_changes() {
        let temp = tempfile::tempdir().unwrap();
        let cache_root = temp.path().join("cache");
        let source = temp.path().join("background.png");
        write_test_image(&source, 640, 360, [255, 0, 0, 255]);

        let thumb1 = ensure_background_thumbnail(&cache_root, &source)
            .unwrap()
            .unwrap();
        write_test_image(&source, 320, 240, [0, 0, 255, 255]);

        let thumb2 = ensure_background_thumbnail(&cache_root, &source)
            .unwrap()
            .unwrap();
        assert_ne!(thumb1, thumb2);
        assert!(thumb2.exists());
    }
}
