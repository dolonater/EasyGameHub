//! Tauri commands for Steam/2FA authenticator.
//!
//! Bridges `steam-sdk::crypto` (totp, authenticator) to the frontend.

use crate::AppState;
use serde::Serialize;
use steam_sdk::crypto::authenticator::{AuthEntry, AuthEntryManager};
use steam_sdk::crypto::totp;
use tauri::State;

/// DTO for an authenticator entry displayed in the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthEntryDto {
    pub id: String,
    pub issuer: String,
    pub account_name: String,
    pub token_type: String,
    pub digits: u8,
    pub period: u64,
    pub is_active: bool,
    pub code: String,
    pub remaining_seconds: u64,
}

impl AuthEntryDto {
    fn from_entry(entry: &AuthEntry, mgr: &AuthEntryManager) -> Self {
        let code = mgr
            .generate_code(&entry.id)
            .unwrap_or_else(|_| "ERROR".into());
        let remaining = mgr.remaining_seconds(&entry.id).unwrap_or(0);
        Self {
            id: entry.id.clone(),
            issuer: entry.issuer.clone(),
            account_name: entry.account_name.clone(),
            token_type: format!("{:?}", entry.token_type),
            digits: entry.digits,
            period: entry.period,
            is_active: entry.is_active,
            code,
            remaining_seconds: remaining,
        }
    }
}

/// Get the path to the authenticator store file.
fn store_path(tool_dir: &std::path::Path) -> std::path::PathBuf {
    tool_dir.join("auth_store.enc.json")
}

/// List all authenticator entries with their current codes.
#[tauri::command]
pub fn get_auth_entries(state: State<AppState>) -> Result<Vec<AuthEntryDto>, String> {
    let path = store_path(&state.tool_dir);
    let mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;
    let entries = mgr.all_entries().to_vec();
    let dtos: Vec<AuthEntryDto> = entries
        .iter()
        .map(|e| AuthEntryDto::from_entry(e, &mgr))
        .collect();
    Ok(dtos)
}

/// Add an authenticator entry manually.
#[tauri::command]
pub fn add_auth_entry(
    state: State<AppState>,
    issuer: String,
    account_name: String,
    secret_base32: String,
    token_type: String,
    digits: u8,
    period: u64,
) -> Result<AuthEntryDto, String> {
    let path = store_path(&state.tool_dir);
    let mut mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;

    let secret = totp::decode_base32_secret(&secret_base32)
        .map_err(|e| format!("Invalid Base32 secret: {}", e))?;

    let token_type_serde = match token_type.to_lowercase().as_str() {
        "steam" => steam_sdk::crypto::authenticator::TokenTypeSerde::Steam,
        "hotp" => steam_sdk::crypto::authenticator::TokenTypeSerde::Hotp,
        _ => steam_sdk::crypto::authenticator::TokenTypeSerde::Totp,
    };

    let entry = AuthEntry {
        id: uuid_v4(),
        issuer,
        account_name,
        token_type: token_type_serde,
        algorithm: steam_sdk::crypto::authenticator::OtpAlgorithmSerde::Sha1,
        digits: if token_type.to_lowercase() == "steam" {
            5
        } else {
            digits
        },
        period: if token_type.to_lowercase() == "hotp" {
            0
        } else {
            period
        },
        counter: 0,
        time_offset: 0,
        secret_encrypted: secret,
        created_at: chrono::Utc::now(),
        serial_number: None,
        device_id: None,
        is_active: true,
    };

    let entry_id = entry.id.clone();
    mgr.add_entry(entry).map_err(|e| e.to_string())?;

    let mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;
    let saved = mgr
        .get_entry(&entry_id)
        .ok_or("Entry not found after save")?;
    Ok(AuthEntryDto::from_entry(saved, &mgr))
}

/// Remove an authenticator entry.
#[tauri::command]
pub fn delete_auth_entry(state: State<AppState>, id: String) -> Result<(), String> {
    let path = store_path(&state.tool_dir);
    let mut mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;
    mgr.remove_entry(&id).map_err(|e| e.to_string())
}

/// Generate a simple UUID v4 for entry IDs.
fn uuid_v4() -> String {
    // Simple UUID v4 generation using random bytes
    let mut bytes = [0u8; 16];
    // Use system time + process ID as entropy (not cryptographically secure
    // but sufficient for local entry IDs)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    for (i, byte) in bytes.iter_mut().enumerate() {
        *byte = ((now >> (i * 8)) & 0xff) as u8;
    }
    // Set version 4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]),
        u16::from_be_bytes([bytes[8], bytes[9]]),
        u64::from_be_bytes([0, 0, 0, 0, bytes[10], bytes[11], bytes[12], bytes[13]]),
    )
}

/// Import an authenticator entry from a TOTP URI (otpauth:// format).
#[tauri::command]
pub fn import_from_uri(state: State<AppState>, uri: String) -> Result<AuthEntryDto, String> {
    // Parse otpauth://totp/Issuer:Account?secret=XXX&issuer=Issuer&...
    let without_prefix = uri
        .strip_prefix("otpauth://totp/")
        .or_else(|| uri.strip_prefix("otpauth://hotp/"))
        .ok_or("Invalid otpauth URI: must start with otpauth://totp/ or otpauth://hotp/")?;

    let token_type = if uri.contains("otpauth://hotp/") {
        "hotp"
    } else {
        "totp"
    };

    // Split path and query
    let (path_part, query_part) = without_prefix
        .split_once('?')
        .ok_or("Invalid URI: missing query parameters")?;

    // Parse issuer:account from path
    let (issuer, account_name) = path_part
        .split_once(':')
        .map(|(i, a)| (i.to_string(), a.to_string()))
        .unwrap_or_else(|| ("".into(), path_part.to_string()));

    // Parse query parameters
    let params: std::collections::HashMap<String, String> = query_part
        .split('&')
        .filter_map(|pair| {
            let (k, v) = pair.split_once('=')?;
            Some((k.to_string(), url_decode(v)))
        })
        .collect();

    let secret_base32 = params
        .get("secret")
        .ok_or("Missing 'secret' parameter in URI")?;

    let issuer = params.get("issuer").cloned().unwrap_or(issuer);

    let digits: u8 = params
        .get("digits")
        .and_then(|d| d.parse().ok())
        .unwrap_or(6);

    let period: u64 = params
        .get("period")
        .and_then(|p| p.parse().ok())
        .unwrap_or(30);

    add_auth_entry(
        state,
        issuer,
        account_name,
        secret_base32.clone(),
        token_type.into(),
        digits,
        period,
    )
}

/// Import from a .maFile (Steam mobile authenticator export JSON).
#[tauri::command]
pub fn import_mafile(state: State<AppState>, json_content: String) -> Result<AuthEntryDto, String> {
    let path = store_path(&state.tool_dir);
    let mut mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;
    let entry = mgr
        .import_mafile(&json_content)
        .map_err(|e| e.to_string())?;
    let entry_id = entry.id.clone();

    let mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;
    let saved = mgr
        .get_entry(&entry_id)
        .ok_or("Entry not found after import")?;
    Ok(AuthEntryDto::from_entry(saved, &mgr))
}

/// Simple URL decode.
fn url_decode(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars();
    while let Some(ch) = chars.next() {
        if ch == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            } else {
                result.push('%');
                result.push_str(&hex);
            }
        } else if ch == '+' {
            result.push(' ');
        } else {
            result.push(ch);
        }
    }
    result
}
