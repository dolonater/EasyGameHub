use std::collections::HashMap;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const STORE_FILE: &str = "music-cookies.json";

#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
struct CookieStore {
    cookies: HashMap<String, String>,
}

pub fn parse_cookie_string(cookie: &str) -> HashMap<String, String> {
    let mut parsed = HashMap::new();
    for part in cookie.split(';') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        parsed.insert(key.to_string(), value.trim().to_string());
    }
    parsed
}

pub fn normalize_cookie_header(raw: &str) -> String {
    let parsed = parse_cookie_string(raw);
    let priority = ["MUSIC_U", "__csrf", "NMTID"];
    let mut parts = Vec::new();
    for key in priority {
        if let Some(value) = parsed.get(key) {
            parts.push(format!("{key}={value}"));
        }
    }
    let mut rest: Vec<_> = parsed
        .into_iter()
        .filter(|(key, _)| !priority.contains(&key.as_str()))
        .collect();
    rest.sort_by(|a, b| a.0.cmp(&b.0));
    parts.extend(
        rest.into_iter()
            .map(|(key, value)| format!("{key}={value}")),
    );
    parts.join("; ")
}

pub fn netease_cookie_has_login(cookie: &str) -> bool {
    parse_cookie_string(cookie)
        .get("MUSIC_U")
        .map(|value| !value.is_empty())
        .unwrap_or(false)
}

pub fn save_cookie(app: &AppHandle, provider: &str, cookie: &str) -> Result<(), anyhow::Error> {
    let mut store = read_store(app)?;
    store
        .cookies
        .insert(provider.to_string(), normalize_cookie_header(cookie));
    write_store(app, &store)
}

pub fn load_cookie(app: &AppHandle, provider: &str) -> Result<String, anyhow::Error> {
    let store = read_store(app)?;
    store
        .cookies
        .get(provider)
        .cloned()
        .ok_or_else(|| anyhow::Error::msg(format!("No music cookie saved for {provider}")))
}

pub fn clear_cookie(app: &AppHandle, provider: &str) -> Result<(), anyhow::Error> {
    let mut store = read_store(app)?;
    store.cookies.remove(provider);
    write_store(app, &store)
}

fn store_path(app: &AppHandle) -> Result<PathBuf, anyhow::Error> {
    let dir = app
        .path()
        .app_data_dir()
        .or_else(|_| std::env::current_dir())
        .map_err(|e| anyhow::Error::msg(e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(STORE_FILE))
}

fn read_store(app: &AppHandle) -> Result<CookieStore, anyhow::Error> {
    let path = store_path(app)?;
    if !path.exists() {
        return Ok(CookieStore::default());
    }
    let data = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&data)?)
}

fn write_store(app: &AppHandle, store: &CookieStore) -> Result<(), anyhow::Error> {
    let path = store_path(app)?;
    let data = serde_json::to_string_pretty(store)?;
    std::fs::write(path, data)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_empty_cookie() {
        assert!(parse_cookie_string("").is_empty());
        assert!(parse_cookie_string(" ; ; ").is_empty());
    }

    #[test]
    fn detects_music_u_login() {
        assert!(netease_cookie_has_login("foo=bar; MUSIC_U=abc; __csrf=xyz"));
        assert!(!netease_cookie_has_login("foo=bar; MUSIC_U="));
        assert!(!netease_cookie_has_login("foo=bar"));
    }

    #[test]
    fn duplicate_cookie_key_last_wins() {
        let parsed = parse_cookie_string("MUSIC_U=old; x=1; MUSIC_U=new");
        assert_eq!(parsed.get("MUSIC_U").map(String::as_str), Some("new"));
    }

    #[test]
    fn preserves_empty_values_and_normalizes_order() {
        assert_eq!(
            normalize_cookie_header("b=2; __csrf=; MUSIC_U=u; a=1"),
            "MUSIC_U=u; __csrf=; a=1; b=2"
        );
    }
}
