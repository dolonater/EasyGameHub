use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use bpi_rs::login::LoginQrPollParams;
use bpi_rs::session::cookie::{format_cookie_pairs, parse_cookie_header, CookiePair};
use bpi_rs::{Account, BpiError};
use image::codecs::png::PngEncoder;
use image::{ColorType, ImageEncoder, Luma};
use qrcode::QrCode;
use rand::RngCore;
use steam_sdk::crypto::secure_store::SecureStore;

use super::client;
use super::models::{BiliQrLoginKey, BiliQrLoginStatus};

const STORE_FILE: &str = "bilibili_account.enc.json";
const KEY_COOKIE: &str = "cookie";
const KEY_UPDATED_AT: &str = "updated_at";

pub fn store_path(tool_dir: &Path) -> PathBuf {
    tool_dir.join(STORE_FILE)
}

pub fn load_cookie(tool_dir: &Path) -> Result<Option<String>, BpiError> {
    let store = SecureStore::open(&store_path(tool_dir)).map_err(secure_store_error)?;
    let Some(bytes) = store.get(KEY_COOKIE).map_err(secure_store_error)? else {
        return Ok(None);
    };
    let cookie = String::from_utf8(bytes)
        .map_err(|_| BpiError::parse("stored Bilibili cookie is not valid UTF-8"))?;
    Ok((!cookie.trim().is_empty()).then_some(cookie))
}

pub fn save_cookie(tool_dir: &Path, cookie: &str) -> Result<(), BpiError> {
    let normalized = normalize_cookie_header(cookie)?;
    let mut store = SecureStore::open(&store_path(tool_dir)).map_err(secure_store_error)?;
    store
        .set(KEY_COOKIE, normalized.as_bytes())
        .map_err(secure_store_error)?;
    store
        .set(KEY_UPDATED_AT, chrono::Utc::now().to_rfc3339().as_bytes())
        .map_err(secure_store_error)?;
    Ok(())
}

pub fn clear_cookie(tool_dir: &Path) -> Result<(), BpiError> {
    let mut store = SecureStore::open(&store_path(tool_dir)).map_err(secure_store_error)?;
    store.remove(KEY_COOKIE).map_err(secure_store_error)?;
    store.remove(KEY_UPDATED_AT).map_err(secure_store_error)?;
    Ok(())
}

pub fn cookie_to_account(cookie: &str) -> Option<Account> {
    Account::from_cookie_header(cookie)
        .ok()
        .filter(Account::is_complete)
}

pub async fn login_qr_key() -> Result<BiliQrLoginKey, BpiError> {
    let data = client::anonymous_client()?.login().qr_generate().await?;
    Ok(BiliQrLoginKey {
        key: data.qrcode_key,
        qr_url: data.url.clone(),
        qr_image: qr_data_url(&data.url)?,
    })
}

pub async fn login_qr_check(tool_dir: &Path, key: &str) -> Result<BiliQrLoginStatus, BpiError> {
    let poll_cookie = electron_qr_poll_cookie_header();
    let data = client::client_from_cookie(poll_cookie.clone())?
        .login()
        .qr_poll(LoginQrPollParams::new(key)?)
        .await?;

    if data.code != 0 {
        return Ok(BiliQrLoginStatus {
            code: data.code,
            message: data.message,
            logged_in: false,
            login_info: None,
        });
    }

    let cookie = merge_electron_login_cookie(&poll_cookie, &data.cookies)?;
    let cookie = complete_login_cookie_header(&cookie).await?;
    save_cookie(tool_dir, &cookie)?;
    let login_info = client::login_status(tool_dir).await?;

    Ok(BiliQrLoginStatus {
        code: data.code,
        message: data.message,
        logged_in: login_info.logged_in,
        login_info: Some(login_info),
    })
}

fn normalize_cookie_header(cookie: &str) -> Result<String, BpiError> {
    normalize_cookie_header_with_buvid(cookie, None)
}

fn normalize_cookie_header_with_buvid(
    cookie: &str,
    fallback_buvid3: Option<&str>,
) -> Result<String, BpiError> {
    let mut pairs = parse_cookie_header(cookie)?;
    let mut account = Account::from_cookie_pairs(&pairs);
    if account.buvid3.is_empty() {
        if let Some(buvid3) = fallback_buvid3.filter(|value| !value.trim().is_empty()) {
            account.buvid3 = buvid3.to_string();
            upsert_cookie_pair(&mut pairs, "buvid3", buvid3);
        }
    }
    account.validate_complete()?;
    Ok(format_cookie_pairs(&pairs))
}

async fn complete_login_cookie_header(cookie: &str) -> Result<String, BpiError> {
    let account = Account::from_cookie_header(cookie)?;
    if account.is_complete() {
        return normalize_cookie_header(cookie);
    }

    let has_login_cookie = !account.dede_user_id.is_empty()
        && !account.sessdata.is_empty()
        && !account.bili_jct.is_empty();
    if !has_login_cookie || !account.buvid3.is_empty() {
        account.validate_complete()?;
    }

    let web_client = client::client_from_cookie(cookie.to_string())?;
    let buvid3 = match web_client.misc().buvid().await {
        Ok(data) => data.buvid3,
        Err(first_error) => match web_client.misc().buvid3().await {
            Ok(data) => data.buvid,
            Err(second_error) => {
                return Err(BpiError::parse(format!(
                    "failed to fetch Bilibili buvid3 after login: {first_error}; fallback failed: {second_error}"
                )));
            }
        },
    };

    normalize_cookie_header_with_buvid(cookie, Some(&buvid3))
}

fn upsert_cookie_pair(pairs: &mut Vec<CookiePair>, key: &str, value: &str) {
    let mut replaced = false;
    pairs.retain_mut(|(pair_key, pair_value)| {
        if pair_key.eq_ignore_ascii_case(key) {
            if replaced {
                return false;
            }
            *pair_key = key.to_string();
            *pair_value = value.to_string();
            replaced = true;
        }
        true
    });
    if !replaced {
        pairs.push((key.to_string(), value.to_string()));
    }
}

fn electron_qr_poll_cookie_header() -> String {
    format_cookie_pairs(&vec![
        ("appkey".to_string(), "aa1e74ee4874176e".to_string()),
        ("mobi_app".to_string(), "pc_electron".to_string()),
        ("device".to_string(), "mac".to_string()),
        ("innersign".to_string(), "0".to_string()),
        ("buvid3".to_string(), random_uuid()),
        ("device_id".to_string(), random_device_id()),
        ("device_name".to_string(), "EasyGameHub".to_string()),
    ])
}

fn merge_electron_login_cookie(
    poll_cookie: &str,
    response_cookies: &[CookiePair],
) -> Result<String, BpiError> {
    let mut pairs = parse_cookie_header(poll_cookie)?;
    let poll_uuid = pairs
        .iter()
        .find(|(key, value)| key.eq_ignore_ascii_case("buvid3") && !value.is_empty())
        .map(|(_, value)| value.clone());

    if let Some(uuid) = poll_uuid {
        upsert_cookie_pair(&mut pairs, "_uuid", &uuid);
    }
    upsert_cookie_pair(&mut pairs, "buvid3", &random_hex(32));

    for (key, value) in response_cookies {
        upsert_cookie_pair(&mut pairs, key, value);
    }

    normalize_cookie_header(&format_cookie_pairs(&pairs))
}

fn random_hex(len: usize) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut bytes = vec![0; len];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes
        .into_iter()
        .map(|byte| HEX[(byte & 0x0f) as usize] as char)
        .collect()
}

fn random_uuid() -> String {
    format!(
        "{}-{}-{}-{}-{}infoc",
        random_hex(8),
        random_hex(4),
        random_hex(4),
        random_hex(4),
        random_hex(17)
    )
}

fn random_device_id() -> String {
    format!(
        "{}-{}-{}-{}-{}",
        random_hex(8),
        random_hex(4),
        random_hex(4),
        random_hex(4),
        random_hex(12)
    )
}

fn qr_data_url(qr_url: &str) -> Result<String, BpiError> {
    let code = QrCode::new(qr_url.as_bytes())
        .map_err(|err| BpiError::parse(format!("failed to generate QR code: {err}")))?;
    let image = code.render::<Luma<u8>>().min_dimensions(256, 256).build();
    let mut png = Vec::new();
    let encoder = PngEncoder::new(&mut png);
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ColorType::L8.into(),
        )
        .map_err(|err| BpiError::parse(format!("failed to encode QR image: {err}")))?;
    Ok(format!("data:image/png;base64,{}", BASE64.encode(png)))
}

fn secure_store_error(error: steam_sdk::error::SteamError) -> BpiError {
    BpiError::parse(format!("secure store error: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_cookie_returns_none_for_empty_store() -> Result<(), BpiError> {
        let dir = tempdir("empty");
        assert!(load_cookie(&dir)?.is_none());
        Ok(())
    }

    #[test]
    fn save_load_and_clear_cookie_roundtrip() -> Result<(), BpiError> {
        let dir = tempdir("roundtrip");
        let cookie = "DedeUserID=42; SESSDATA=session; bili_jct=csrf; buvid3=buvid";

        save_cookie(&dir, cookie)?;

        let loaded = load_cookie(&dir)?.expect("cookie should be stored");
        assert!(loaded.contains("DedeUserID=42"));
        assert!(loaded.contains("SESSDATA=session"));
        assert!(loaded.contains("bili_jct=csrf"));
        assert!(loaded.contains("buvid3=buvid"));

        clear_cookie(&dir)?;
        assert!(load_cookie(&dir)?.is_none());
        Ok(())
    }

    #[test]
    fn cookie_to_account_requires_complete_cookie() {
        let account =
            cookie_to_account("DedeUserID=42; SESSDATA=session; bili_jct=csrf; buvid3=buvid")
                .expect("complete cookie should produce account");
        assert_eq!(account.dede_user_id, "42");
        assert_eq!(account.sessdata, "session");
        assert_eq!(account.bili_jct, "csrf");
        assert_eq!(account.buvid3, "buvid");

        assert!(cookie_to_account("SESSDATA=session").is_none());
    }

    #[test]
    fn normalize_cookie_header_accepts_login_cookie_with_buvid_fallback() -> Result<(), BpiError> {
        let cookie = "DedeUserID=42; SESSDATA=session; bili_jct=csrf";

        let normalized = normalize_cookie_header_with_buvid(cookie, Some("generated-buvid"))?;

        assert!(normalized.contains("DedeUserID=42"));
        assert!(normalized.contains("SESSDATA=session"));
        assert!(normalized.contains("bili_jct=csrf"));
        assert!(normalized.contains("buvid3=generated-buvid"));
        Ok(())
    }

    #[test]
    fn normalize_cookie_header_preserves_extra_cookie_pairs() -> Result<(), BpiError> {
        let cookie =
            "DedeUserID=42; DedeUserID__ckMd5=ck; SESSDATA=session; bili_jct=csrf; buvid3=buvid; extra_cookie=extra";

        let normalized = normalize_cookie_header(cookie)?;

        assert!(normalized.contains("DedeUserID__ckMd5=ck"));
        assert!(normalized.contains("extra_cookie=extra"));
        Ok(())
    }

    #[test]
    fn normalize_cookie_header_keeps_existing_wiliwili_device_cookies() -> Result<(), BpiError> {
        let cookie = "DedeUserID=42; SESSDATA=session; bili_jct=csrf; buvid3=buvid; _uuid=custom-uuid; device_id=custom-device; device_name=Custom";

        let normalized = normalize_cookie_header(cookie)?;

        assert!(normalized.contains("_uuid=custom-uuid"));
        assert!(normalized.contains("device_id=custom-device"));
        assert!(normalized.contains("device_name=Custom"));
        Ok(())
    }

    #[test]
    fn merge_electron_login_cookie_keeps_poll_device_cookie_shape() -> Result<(), BpiError> {
        let poll_cookie = electron_qr_poll_cookie_header();
        let merged = merge_electron_login_cookie(
            &poll_cookie,
            &[
                ("DedeUserID".to_string(), "42".to_string()),
                ("SESSDATA".to_string(), "session".to_string()),
                ("bili_jct".to_string(), "csrf".to_string()),
                ("DedeUserID__ckMd5".to_string(), "ck".to_string()),
            ],
        )?;
        let pairs = parse_cookie_header(&merged)?;
        let cookie_value = |name: &str| {
            pairs
                .iter()
                .find(|(key, value)| key.eq_ignore_ascii_case(name) && !value.is_empty())
                .map(|(_, value)| value.as_str())
        };

        assert_eq!(cookie_value("appkey"), Some("aa1e74ee4874176e"));
        assert_eq!(cookie_value("mobi_app"), Some("pc_electron"));
        assert_eq!(cookie_value("device"), Some("mac"));
        assert_eq!(cookie_value("innersign"), Some("0"));
        assert_eq!(cookie_value("device_name"), Some("EasyGameHub"));
        assert!(cookie_value("_uuid").is_some_and(|value| value.ends_with("infoc")));
        assert!(cookie_value("device_id").is_some_and(|value| value.contains('-')));
        assert!(cookie_value("buvid3").is_some_and(|value| !value.ends_with("infoc")));
        assert_eq!(cookie_value("DedeUserID"), Some("42"));
        assert_eq!(cookie_value("SESSDATA"), Some("session"));
        assert_eq!(cookie_value("bili_jct"), Some("csrf"));
        assert_eq!(cookie_value("DedeUserID__ckMd5"), Some("ck"));
        Ok(())
    }

    fn tempdir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "easygamehub-bilibili-{label}-{}-{nanos}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}
