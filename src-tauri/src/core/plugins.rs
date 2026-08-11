use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;

/// Highest api_version the current SDK supports.
pub const MAX_API_VERSION: u32 = 1;

/// Permission names understood by the SDK allowlist.
pub const KNOWN_PERMISSIONS: [&str; 6] = [
    "core.read",
    "core.backup",
    "events",
    "ui",
    "music",
    "bilibili",
];

const MAX_ENTRY_SIZE: u64 = 50 * 1024 * 1024;
const MAX_ENTRIES: usize = 30;

/// Plugin manifest — validated at install time, mirrors the zip's manifest.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub api_version: u32,
    pub entry: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    /// Optional display icon: an asset path (`assets/xxx`) or an app Icon name.
    #[serde(default)]
    pub icon: Option<String>,
    /// Optional one-line display description.
    #[serde(default)]
    pub description: Option<String>,
}

/// One entry in the global plugin registry (plugins_registry.json).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub api_version: u32,
    pub entry: String,
    pub permissions: Vec<String>,
    pub enabled: bool,
    pub installed_at: String,
    pub last_error: Option<String>,
    pub error_count: u32,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

impl PluginRecord {
    pub fn from_manifest(manifest: &PluginManifest) -> Self {
        Self {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            api_version: manifest.api_version,
            entry: manifest.entry.clone(),
            permissions: manifest.permissions.clone(),
            enabled: true,
            installed_at: chrono::Local::now().to_rfc3339(),
            last_error: None,
            error_count: 0,
            icon: manifest.icon.clone(),
            description: manifest.description.clone(),
        }
    }
}

/// Global plugin registry persisted at plugins/plugins_registry.json.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PluginRegistry {
    pub plugins: Vec<PluginRecord>,
}

/// Parse and validate manifest bytes (the zip's manifest.json).
pub fn parse_manifest(bytes: &[u8]) -> Result<PluginManifest, anyhow::Error> {
    let manifest: PluginManifest = serde_json::from_slice(bytes)?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

/// Validate manifest fields. `id` doubles as the on-disk directory name,
/// so it is restricted to safe characters.
pub fn validate_manifest(m: &PluginManifest) -> Result<(), anyhow::Error> {
    if !valid_id(&m.id) {
        anyhow::bail!(
            "Invalid plugin id: {:?} (must match [a-z0-9.] start, then [a-z0-9.-])",
            m.id
        );
    }
    if m.name.is_empty() || m.name.chars().count() > 40 {
        anyhow::bail!("Invalid plugin name length: {}", m.name.chars().count());
    }
    if !valid_version(&m.version) {
        anyhow::bail!("Invalid plugin version: {:?}", m.version);
    }
    if m.api_version == 0 {
        anyhow::bail!("api_version must be >= 1");
    }
    if m.entry != "bundle.js" {
        anyhow::bail!("entry must be bundle.js, got {:?}", m.entry);
    }
    if let Some(icon) = &m.icon {
        if icon.len() > 128
            || !icon
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '/')
        {
            anyhow::bail!("Invalid plugin icon: {:?}", icon);
        }
    }
    if let Some(description) = &m.description {
        if description.chars().count() > 200 {
            anyhow::bail!(
                "Invalid plugin description length: {} (max 200)",
                description.chars().count()
            );
        }
    }
    for perm in &m.permissions {
        if !KNOWN_PERMISSIONS.contains(&perm.as_str()) {
            anyhow::bail!("Unknown permission: {}", perm);
        }
    }
    Ok(())
}

fn valid_id(id: &str) -> bool {
    let mut chars = id.chars();
    match chars.next() {
        Some(c) if c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' => {}
        _ => return false,
    }
    !id.is_empty()
        && id.len() <= 64
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-')
}

fn valid_version(v: &str) -> bool {
    if v.is_empty() || v.len() > 32 {
        return false;
    }
    v.split('.')
        .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
}

/// True when the SDK (max) can run a plugin declaring `api_version`.
pub fn is_supported(api_version: u32, max_api_version: u32) -> bool {
    api_version <= max_api_version && api_version > 0
}

/// Load registry from disk; missing file yields an empty registry.
pub fn load_registry(path: &Path) -> Result<PluginRegistry, anyhow::Error> {
    if !path.exists() {
        return Ok(PluginRegistry::default());
    }
    let data = fs::read_to_string(path)?;
    let reg: PluginRegistry = serde_json::from_str(&data)?;
    Ok(reg)
}

/// Save registry to disk.
pub fn save_registry(path: &Path, registry: &PluginRegistry) -> Result<(), anyhow::Error> {
    let data = serde_json::to_string_pretty(registry)?;
    fs::write(path, data)?;
    Ok(())
}

/// Normalize a zip entry name to a safe relative path. Returns None for
/// path traversal (`..`, absolute paths, drive letters via backslash).
fn normalize_zip_path(name: &str) -> Option<String> {
    let normalized = name.replace('\\', "/");
    let mut parts: Vec<&str> = Vec::new();
    for part in normalized.split('/') {
        match part {
            "" | "." => {}
            ".." => return None,
            _ => parts.push(part),
        }
    }
    if parts.is_empty() {
        return None;
    }
    Some(parts.join("/"))
}

/// Extract a plugin zip into `plugins_dir/<id>/`.
///
/// - Only `manifest.json`, `bundle.js` and `assets/*` entries are allowed
/// - Path traversal / absolute paths are rejected (zip-slip)
/// - Entry size and count limits are enforced
/// - Extraction goes through a temp dir and is atomically renamed into place,
///   so a same-id reinstall atomically replaces the previous version
pub fn extract_plugin_zip(
    zip_path: &Path,
    plugins_dir: &Path,
) -> Result<PluginManifest, anyhow::Error> {
    if !plugins_dir.exists() {
        fs::create_dir_all(plugins_dir)?;
    }

    let file = fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    if archive.len() > MAX_ENTRIES {
        anyhow::bail!(
            "Plugin zip has too many entries: {} (max {})",
            archive.len(),
            MAX_ENTRIES
        );
    }

    let mut manifest_bytes: Option<Vec<u8>> = None;
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        if entry.size() > MAX_ENTRY_SIZE {
            anyhow::bail!("Plugin entry exceeds size limit: {}", entry.name());
        }
        let normalized = normalize_zip_path(entry.name())
            .ok_or_else(|| anyhow::Error::msg(format!("Invalid entry path: {}", entry.name())))?;
        let allowed = normalized == "manifest.json"
            || normalized == "bundle.js"
            || normalized.starts_with("assets/");
        if !allowed {
            anyhow::bail!("Unexpected entry in plugin zip: {}", entry.name());
        }
        let mut buf = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut buf)?;
        if normalized == "manifest.json" {
            manifest_bytes = Some(buf);
        } else {
            files.push((normalized, buf));
        }
    }

    let manifest_bytes =
        manifest_bytes.ok_or_else(|| anyhow::Error::msg("manifest.json missing"))?;
    let manifest = parse_manifest(&manifest_bytes)?;

    let target = plugins_dir.join(&manifest.id);
    let tmp = plugins_dir.join(format!(".tmp-{}", manifest.id));
    if tmp.exists() {
        fs::remove_dir_all(&tmp)?;
    }
    fs::create_dir_all(&tmp)?;

    fs::write(tmp.join("manifest.json"), &manifest_bytes)?;
    for (name, data) in files {
        if name == "bundle.js" {
            fs::write(tmp.join("bundle.js"), data)?;
        } else {
            let dest = tmp.join(&name);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(dest, data)?;
        }
    }

    if target.exists() {
        fs::remove_dir_all(&target)?;
    }
    fs::rename(&tmp, &target)?;

    Ok(manifest)
}

/// Remove a plugin folder. Missing folder is treated as success.
pub fn remove_plugin_dir(plugins_dir: &Path, id: &str) -> Result<(), anyhow::Error> {
    let dir = plugins_dir.join(id);
    if dir.exists() {
        fs::remove_dir_all(&dir)?;
    }
    Ok(())
}

/// Sync official built-in plugins from resources/defaults/plugins into the
/// runtime plugins directory. User config is preserved, and disabled records
/// stay disabled when a built-in bundle is updated.
pub fn sync_builtin_plugins(
    defaults_plugins_dir: &Path,
    plugins_dir: &Path,
    registry_path: &Path,
) -> Result<(), anyhow::Error> {
    if !defaults_plugins_dir.exists() {
        return Ok(());
    }
    fs::create_dir_all(plugins_dir)?;

    let mut registry = load_registry(registry_path)?;
    let mut changed = false;

    for entry in fs::read_dir(defaults_plugins_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let source_dir = entry.path();
        let manifest_bytes = fs::read(source_dir.join("manifest.json"))?;
        let manifest = parse_manifest(&manifest_bytes)?;
        let target_dir = plugins_dir.join(&manifest.id);

        let existing_index = registry.plugins.iter().position(|p| p.id == manifest.id);
        let should_copy = !target_dir.exists()
            || existing_index
                .and_then(|i| registry.plugins.get(i))
                .map(|record| version_newer(&manifest.version, &record.version))
                .unwrap_or(true);

        if should_copy {
            copy_builtin_plugin_dir(&source_dir, &target_dir, plugins_dir, &manifest.id)?;
        }

        match existing_index {
            Some(index) => {
                if should_copy {
                    let existing = registry.plugins[index].clone();
                    registry.plugins[index] = PluginRecord {
                        id: manifest.id.clone(),
                        name: manifest.name.clone(),
                        version: manifest.version.clone(),
                        api_version: manifest.api_version,
                        entry: manifest.entry.clone(),
                        permissions: manifest.permissions.clone(),
                        enabled: existing.enabled,
                        installed_at: existing.installed_at,
                        last_error: existing.last_error,
                        error_count: existing.error_count,
                        icon: manifest.icon.clone(),
                        description: manifest.description.clone(),
                    };
                    changed = true;
                }
            }
            None => {
                registry
                    .plugins
                    .push(PluginRecord::from_manifest(&manifest));
                changed = true;
            }
        }
    }

    if changed {
        save_registry(registry_path, &registry)?;
    }
    Ok(())
}

fn copy_builtin_plugin_dir(
    source_dir: &Path,
    target_dir: &Path,
    plugins_dir: &Path,
    id: &str,
) -> Result<(), anyhow::Error> {
    let tmp = plugins_dir.join(format!(".builtin-tmp-{}", id));
    if tmp.exists() {
        fs::remove_dir_all(&tmp)?;
    }
    fs::create_dir_all(&tmp)?;

    copy_builtin_payload(source_dir, &tmp)?;

    let config_path = target_dir.join("config.json");
    if config_path.exists() {
        fs::copy(&config_path, tmp.join("config.json"))?;
    }

    if target_dir.exists() {
        fs::remove_dir_all(target_dir)?;
    }
    fs::rename(&tmp, target_dir)?;
    Ok(())
}

fn copy_builtin_payload(source_dir: &Path, target_dir: &Path) -> Result<(), anyhow::Error> {
    fs::copy(
        source_dir.join("manifest.json"),
        target_dir.join("manifest.json"),
    )?;
    fs::copy(source_dir.join("bundle.js"), target_dir.join("bundle.js"))?;

    let assets = source_dir.join("assets");
    if assets.exists() {
        copy_dir_recursive(&assets, &target_dir.join("assets"))?;
    }
    Ok(())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), anyhow::Error> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(source_path, target_path)?;
        }
    }
    Ok(())
}

fn version_newer(candidate: &str, current: &str) -> bool {
    let candidate_parts = version_parts(candidate);
    let current_parts = version_parts(current);
    candidate_parts > current_parts
}

fn version_parts(version: &str) -> Vec<u32> {
    version
        .split('.')
        .map(|part| part.parse::<u32>().unwrap_or(0))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn sample_manifest() -> Vec<u8> {
        br#"{"id":"com.example.test","name":"Test","version":"1.0.0","api_version":1,"entry":"bundle.js","permissions":["core.read"],"icon":"assets/logo.png","description":"A test plugin"}"#.to_vec()
    }

    fn manifest_from_json(json: &str) -> Vec<u8> {
        json.as_bytes().to_vec()
    }

    fn build_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buf);
            let options = SimpleFileOptions::default();
            for (name, data) in entries {
                writer.start_file(*name, options).unwrap();
                writer.write_all(data).unwrap();
            }
            writer.finish().unwrap();
        }
        buf.into_inner()
    }

    #[test]
    fn parses_valid_manifest() {
        let m = parse_manifest(&sample_manifest()).unwrap();
        assert_eq!(m.id, "com.example.test");
        assert_eq!(m.api_version, 1);
        assert_eq!(m.permissions, vec!["core.read"]);
        assert_eq!(m.icon.as_deref(), Some("assets/logo.png"));
        assert_eq!(m.description.as_deref(), Some("A test plugin"));
    }

    #[test]
    fn optional_icon_description_default_missing() {
        let m = parse_manifest(&manifest_from_json(
            r#"{"id":"com.example.test","name":"Test","version":"1.0.0","api_version":1,"entry":"bundle.js"}"#,
        ))
        .unwrap();
        assert_eq!(m.icon, None);
        assert_eq!(m.description, None);
    }

    #[test]
    fn rejects_bad_icon_and_long_description() {
        let json = manifest_from_json(
            r#"{"id":"a.b","name":"T","version":"1.0","api_version":1,"entry":"bundle.js","icon":"bad icon!"}"#,
        );
        assert!(parse_manifest(&json).is_err(), "invalid icon must fail");
        let long = "x".repeat(201);
        let json = format!(
            r#"{{"id":"a.b","name":"T","version":"1.0","api_version":1,"entry":"bundle.js","description":"{}"}}"#,
            long
        );
        assert!(
            parse_manifest(json.as_bytes()).is_err(),
            "long description must fail"
        );
    }

    #[test]
    fn accepts_music_permission() {
        let json = manifest_from_json(
            r#"{"id":"com.example.music","name":"Music","version":"1.0.0","api_version":1,"entry":"bundle.js","permissions":["ui","music"]}"#,
        );
        let m = parse_manifest(&json).unwrap();
        assert_eq!(m.permissions, vec!["ui", "music"]);
    }

    #[test]
    fn accepts_bilibili_permission() {
        let json = manifest_from_json(
            r#"{"id":"com.example.bilibili","name":"Bilibili","version":"1.0.0","api_version":1,"entry":"bundle.js","permissions":["ui","bilibili"]}"#,
        );
        let m = parse_manifest(&json).unwrap();
        assert_eq!(m.permissions, vec!["ui", "bilibili"]);
    }

    #[test]
    fn rejects_missing_fields() {
        let json = br#"{"id":"com.example.test"}"#;
        assert!(parse_manifest(json).is_err());
        let json = manifest_from_json(
            r#"{"id":"com.example.test","name":"T","version":"1.0.0","api_version":1,"entry":"bundle.js","permissions":["nope"]}"#,
        );
        assert!(
            parse_manifest(&json).is_err(),
            "unknown permission must be rejected"
        );
    }

    #[test]
    fn rejects_invalid_ids() {
        for bad in ["../evil", "a b", "a/b", "A-B", "", "-lead"] {
            let json = format!(
                r#"{{"id":"{}","name":"T","version":"1.0.0","api_version":1,"entry":"bundle.js"}}"#,
                bad
            );
            assert!(
                parse_manifest(json.as_bytes()).is_err(),
                "id {:?} must fail",
                bad
            );
        }
    }

    #[test]
    fn rejects_bad_version_and_api() {
        let json = manifest_from_json(
            r#"{"id":"a.b","name":"T","version":"","api_version":1,"entry":"bundle.js"}"#,
        );
        assert!(parse_manifest(&json).is_err());
        let json = manifest_from_json(
            r#"{"id":"a.b","name":"T","version":"1.0","api_version":0,"entry":"bundle.js"}"#,
        );
        assert!(parse_manifest(&json).is_err());
        let json = manifest_from_json(
            r#"{"id":"a.b","name":"T","version":"1.0","api_version":1,"entry":"main.js"}"#,
        );
        assert!(parse_manifest(&json).is_err(), "entry must be bundle.js");
    }

    #[test]
    fn api_version_compat() {
        assert!(is_supported(1, 1));
        assert!(is_supported(1, 2));
        assert!(!is_supported(2, 1));
        assert!(!is_supported(0, 1));
    }

    #[test]
    fn registry_roundtrip() {
        let dir = tempdir();
        let path = dir.join("plugins_registry.json");
        let mut reg = PluginRegistry::default();
        reg.plugins.push(PluginRecord {
            id: "com.example.test".into(),
            name: "Test".into(),
            version: "1.0.0".into(),
            api_version: 1,
            entry: "bundle.js".into(),
            permissions: vec!["core.read".into()],
            enabled: true,
            installed_at: "2026-08-04T00:00:00+08:00".into(),
            last_error: None,
            error_count: 0,
            icon: Some("assets/logo.png".into()),
            description: Some("A test plugin".into()),
        });
        save_registry(&path, &reg).unwrap();
        let loaded = load_registry(&path).unwrap();
        assert_eq!(loaded.plugins.len(), 1);
        assert_eq!(loaded.plugins[0].id, "com.example.test");
        assert!(loaded.plugins[0].enabled);
    }

    #[test]
    fn missing_registry_is_empty() {
        let dir = tempdir();
        let reg = load_registry(&dir.join("nope.json")).unwrap();
        assert!(reg.plugins.is_empty());
    }

    #[test]
    fn extracts_valid_zip() {
        let dir = tempdir();
        let zip_data = build_zip(&[
            ("manifest.json", &sample_manifest()),
            ("bundle.js", b"export const x = 1;"),
            ("assets/logo.png", b"PNG"),
        ]);
        let zip_path = dir.join("p.zip");
        std::fs::write(&zip_path, &zip_data).unwrap();

        let plugins_dir = dir.join("plugins");
        let manifest = extract_plugin_zip(&zip_path, &plugins_dir).unwrap();
        assert_eq!(manifest.id, "com.example.test");

        let target = plugins_dir.join("com.example.test");
        assert!(target.join("bundle.js").exists());
        assert!(target.join("manifest.json").exists());
        assert!(target.join("assets/logo.png").exists());
        assert!(
            !dir.join(".tmp-com.example.test").exists(),
            "temp dir must be cleaned up"
        );
    }

    #[test]
    fn rejects_zip_slip_traversal() {
        let dir = tempdir();
        let zip_data = build_zip(&[
            ("manifest.json", &sample_manifest()),
            ("../evil.js", b"evil"),
        ]);
        let zip_path = dir.join("evil.zip");
        std::fs::write(&zip_path, &zip_data).unwrap();

        let plugins_dir = dir.join("plugins");
        let err = extract_plugin_zip(&zip_path, &plugins_dir).unwrap_err();
        assert!(
            err.to_string().contains("Invalid entry path"),
            "got: {}",
            err
        );
        assert!(!dir.join("evil.js").exists());
    }

    #[test]
    fn rejects_absolute_path_entry() {
        let dir = tempdir();
        let zip_data = build_zip(&[
            ("manifest.json", &sample_manifest()),
            ("C:/evil.js", b"evil"),
        ]);
        let zip_path = dir.join("abs.zip");
        std::fs::write(&zip_path, &zip_data).unwrap();

        let plugins_dir = dir.join("plugins");
        let err = extract_plugin_zip(&zip_path, &plugins_dir).unwrap_err();
        assert!(err.to_string().contains("Unexpected entry"), "got: {}", err);
    }

    #[test]
    fn rejects_missing_manifest() {
        let dir = tempdir();
        let zip_data = build_zip(&[("bundle.js", b"x")]);
        let zip_path = dir.join("nomanifest.zip");
        std::fs::write(&zip_path, &zip_data).unwrap();
        assert!(extract_plugin_zip(&zip_path, &dir.join("plugins")).is_err());
    }

    #[test]
    fn reinstall_same_id_overwrites() {
        let dir = tempdir();
        let plugins_dir = dir.join("plugins");

        let v1 = manifest_from_json(
            r#"{"id":"a.b","name":"V1","version":"1.0.0","api_version":1,"entry":"bundle.js"}"#,
        );
        let zip_path = dir.join("v1.zip");
        std::fs::write(
            &zip_path,
            build_zip(&[("manifest.json", &v1), ("bundle.js", b"v1")]),
        )
        .unwrap();
        extract_plugin_zip(&zip_path, &plugins_dir).unwrap();

        let v2 = manifest_from_json(
            r#"{"id":"a.b","name":"V2","version":"2.0.0","api_version":1,"entry":"bundle.js"}"#,
        );
        let zip_path2 = dir.join("v2.zip");
        std::fs::write(
            &zip_path2,
            build_zip(&[("manifest.json", &v2), ("bundle.js", b"v2")]),
        )
        .unwrap();
        let manifest = extract_plugin_zip(&zip_path2, &plugins_dir).unwrap();

        assert_eq!(manifest.version, "2.0.0");
        let bundle = std::fs::read(plugins_dir.join("a.b/bundle.js")).unwrap();
        assert_eq!(bundle, b"v2");
    }

    #[test]
    fn sync_builtin_plugins_installs_missing_default_plugin() {
        let dir = tempdir();
        let defaults = dir
            .join("defaults")
            .join("plugins")
            .join("com.easygamehub.netease-music");
        let plugins_dir = dir.join("runtime").join("plugins");
        let registry_path = plugins_dir.join("plugins_registry.json");
        std::fs::create_dir_all(&defaults).unwrap();
        std::fs::write(
            defaults.join("manifest.json"),
            br#"{"id":"com.easygamehub.netease-music","name":"Music","version":"0.1.0","api_version":1,"entry":"bundle.js","permissions":["ui","music"]}"#,
        )
        .unwrap();
        std::fs::write(defaults.join("bundle.js"), b"bundle").unwrap();

        sync_builtin_plugins(defaults.parent().unwrap(), &plugins_dir, &registry_path).unwrap();

        assert_eq!(
            std::fs::read(
                plugins_dir
                    .join("com.easygamehub.netease-music")
                    .join("bundle.js")
            )
            .unwrap(),
            b"bundle"
        );
        let registry = load_registry(&registry_path).unwrap();
        assert_eq!(registry.plugins.len(), 1);
        assert_eq!(registry.plugins[0].id, "com.easygamehub.netease-music");
        assert!(registry.plugins[0].enabled);
    }

    #[test]
    fn sync_builtin_plugins_preserves_disabled_state_and_config_on_update() {
        let dir = tempdir();
        let defaults = dir
            .join("defaults")
            .join("plugins")
            .join("com.easygamehub.netease-music");
        let plugins_dir = dir.join("runtime").join("plugins");
        let installed = plugins_dir.join("com.easygamehub.netease-music");
        let registry_path = plugins_dir.join("plugins_registry.json");
        std::fs::create_dir_all(&defaults).unwrap();
        std::fs::create_dir_all(&installed).unwrap();
        std::fs::write(
            defaults.join("manifest.json"),
            br#"{"id":"com.easygamehub.netease-music","name":"Music","version":"0.2.0","api_version":1,"entry":"bundle.js","permissions":["ui","music"]}"#,
        )
        .unwrap();
        std::fs::write(defaults.join("bundle.js"), b"new").unwrap();
        std::fs::write(installed.join("manifest.json"), br#"{"id":"com.easygamehub.netease-music","name":"Music","version":"0.1.0","api_version":1,"entry":"bundle.js","permissions":["ui","music"]}"#).unwrap();
        std::fs::write(installed.join("bundle.js"), b"old").unwrap();
        std::fs::write(installed.join("config.json"), b"{\"volume\":0.5}").unwrap();
        save_registry(
            &registry_path,
            &PluginRegistry {
                plugins: vec![PluginRecord {
                    id: "com.easygamehub.netease-music".into(),
                    name: "Music".into(),
                    version: "0.1.0".into(),
                    api_version: 1,
                    entry: "bundle.js".into(),
                    permissions: vec!["ui".into(), "music".into()],
                    enabled: false,
                    installed_at: "2026-08-04T00:00:00+08:00".into(),
                    last_error: None,
                    error_count: 0,
                    icon: None,
                    description: None,
                }],
            },
        )
        .unwrap();

        sync_builtin_plugins(defaults.parent().unwrap(), &plugins_dir, &registry_path).unwrap();

        assert_eq!(std::fs::read(installed.join("bundle.js")).unwrap(), b"new");
        assert_eq!(
            std::fs::read(installed.join("config.json")).unwrap(),
            b"{\"volume\":0.5}"
        );
        let registry = load_registry(&registry_path).unwrap();
        assert_eq!(registry.plugins[0].version, "0.2.0");
        assert!(!registry.plugins[0].enabled);
    }

    fn tempdir() -> std::path::PathBuf {
        let raw = std::thread::current()
            .name()
            .unwrap_or("unnamed")
            .to_string();
        let name: String = raw
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        let dir = std::env::temp_dir().join(format!("plugin-test-{}-{}", std::process::id(), name));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}
