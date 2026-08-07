//! Steam Authenticator enrollment / binding flow.
//!
//! Translated from SteamTools:
//! - `SteamAuthenticatorServiceImpl.cs` → `AddAuthenticatorAsync`, `FinalizeAddAuthenticatorAsync`
//! - `SteamAuthenticator.cs` → `AddAuthenticatorAsync`, `FinalizeAddAuthenticatorAsync`
//!
//! The enrollment flow binds a new mobile authenticator to a Steam account:
//! 1. `add_authenticator` — starts enrollment, gets shared_secret + serial_number
//! 2. `finalize_add_authenticator` — confirms with SMS activation code + TOTP code

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

// URL constants (from SteamApiUrls.cs)
const STEAM_AUTHENTICATOR_ADD: &str =
    "https://api.steampowered.com/ITwoFactorService/AddAuthenticator/v1/?access_token={0}";
const STEAM_AUTHENTICATOR_FINALIZEADD: &str =
    "https://api.steampowered.com/ITwoFactorService/FinalizeAddAuthenticator/v1/?access_token={0}";

// ── Response types ───────────────────────────────────────────

/// Response from AddAuthenticator.
#[derive(Debug, Clone, Deserialize)]
pub struct AddAuthenticatorResponse {
    pub response: Option<AddAuthenticatorInner>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAuthenticatorInner {
    /// Status code: 1=success, 2=no phone, 29=already has authenticator, 84=rate limit
    pub status: Option<i32>,
    /// Base64-encoded shared secret (for TOTP generation).
    pub shared_secret: Option<String>,
    /// Serial number of the authenticator (used for trade confirmations).
    pub serial_number: Option<String>,
    /// Revocation code (R-code) for removing the authenticator.
    pub revocation_code: Option<String>,
    /// Server time for clock drift calculation.
    pub server_time: Option<String>,
    /// Steam ID string.
    pub steam_id: Option<String>,
    /// Steam guard scheme (usually "2").
    pub steamguard_scheme: Option<String>,
    /// URI for importing into other authenticator apps.
    pub uri: Option<String>,
}

/// Response from FinalizeAddAuthenticator.
#[derive(Debug, Clone, Deserialize)]
pub struct FinalizeAuthenticatorResponse {
    pub response: Option<FinalizeAuthenticatorInner>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FinalizeAuthenticatorInner {
    /// Status: 1=success.
    pub status: Option<i32>,
    /// Whether the server accepted the activation.
    pub success: Option<bool>,
    /// Server time for clock drift.
    pub server_time: Option<String>,
    /// Whether more confirmations are needed.
    pub want_more: Option<bool>,
}

/// Result of a successful enrollment.
#[derive(Debug, Clone)]
pub struct EnrollmentResult {
    /// Base64 shared secret (decoded = raw TOTP key).
    pub shared_secret: String,
    /// Serial number.
    pub serial_number: String,
    /// Revocation code (save this!).
    pub revocation_code: String,
    /// Device ID.
    pub device_id: String,
    /// Server time at enrollment.
    pub server_time: String,
    /// Time offset between local and server.
    pub time_offset_seconds: i64,
}

// ── API calls ────────────────────────────────────────────────

/// Start adding a new authenticator to a Steam account.
///
/// From `SteamAuthenticatorServiceImpl.AddAuthenticatorAsync`.
/// Requires a valid OAuth access token.
pub fn add_authenticator(
    client: &SteamHttpClient,
    access_token: &str,
    steam_id: u64,
    device_id: &str,
) -> Result<EnrollmentResult> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let url = STEAM_AUTHENTICATOR_ADD.replace("{0}", access_token);

    let response = client
        .agent()
        .post(&url)
        .send_form(&[
            ("steamid", &steam_id.to_string()),
            ("authenticator_time", &now.to_string()),
            ("authenticator_type", "1"),
            ("device_identifier", device_id),
            ("sms_phone_id", "1"),
        ])
        .map_err(|e| SteamError::Http(format!("AddAuthenticator failed: {}", e)))?;

    if response.status() != 200 {
        return Err(SteamError::Auth(format!(
            "AddAuthenticator failed: HTTP {}",
            response.status()
        )));
    }

    let body = response
        .into_string()
        .map_err(|e| SteamError::Http(format!("AddAuthenticator read: {}", e)))?;

    let parsed: AddAuthenticatorResponse = serde_json::from_str(&body)
        .map_err(|_| SteamError::Auth(format!("AddAuthenticator parse error: {}", body)))?;

    let inner = parsed
        .response
        .ok_or_else(|| SteamError::Auth("AddAuthenticator: no response field".into()))?;

    match inner.status {
        Some(1) => {} // success
        Some(2) => return Err(SteamError::Auth("Account has no phone number bound".into())),
        Some(29) => {
            return Err(SteamError::Auth(
                "Account already has an authenticator".into(),
            ))
        }
        Some(84) => return Err(SteamError::Auth("Rate limited. Try again later.".into())),
        Some(s) => return Err(SteamError::Auth(format!("AddAuthenticator status: {}", s))),
        None => {
            return Err(SteamError::Auth(
                "AddAuthenticator: no status in response".into(),
            ))
        }
    }

    let shared_secret = inner
        .shared_secret
        .ok_or_else(|| SteamError::Auth("No shared_secret in response".into()))?;
    let serial_number = inner.serial_number.unwrap_or_else(|| "unknown".into());
    let revocation_code = inner
        .revocation_code
        .ok_or_else(|| SteamError::Auth("No revocation_code in response".into()))?;
    let server_time = inner.server_time.unwrap_or_else(|| now.to_string());

    // Calculate time offset
    let server_time_secs: i64 = server_time.parse().unwrap_or(now as i64);
    let time_offset = server_time_secs - (now as i64);

    Ok(EnrollmentResult {
        shared_secret,
        serial_number,
        revocation_code,
        device_id: device_id.to_string(),
        server_time: server_time.clone(),
        time_offset_seconds: time_offset,
    })
}

/// Finalize adding an authenticator with the activation code.
///
/// From `SteamAuthenticatorServiceImpl.FinalizeAddAuthenticatorAsync`.
/// `activation_code` is the SMS/email code Steam sends.
/// `authenticator_code` is the current TOTP code generated from the shared_secret.
pub fn finalize_add_authenticator(
    client: &SteamHttpClient,
    access_token: &str,
    steam_id: u64,
    activation_code: &str,
    authenticator_code: &str,
) -> Result<bool> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let url = STEAM_AUTHENTICATOR_FINALIZEADD.replace("{0}", access_token);

    let response = client
        .agent()
        .post(&url)
        .send_form(&[
            ("steamid", &steam_id.to_string()),
            ("activation_code", activation_code),
            ("validate_sms_code", "1"),
            ("authenticator_code", authenticator_code),
            ("authenticator_time", &now.to_string()),
        ])
        .map_err(|e| SteamError::Http(format!("FinalizeAddAuthenticator failed: {}", e)))?;

    if response.status() != 200 {
        return Err(SteamError::Auth(format!(
            "FinalizeAddAuthenticator failed: HTTP {}",
            response.status()
        )));
    }

    let body = response
        .into_string()
        .map_err(|e| SteamError::Http(format!("FinalizeAddAuthenticator read: {}", e)))?;

    let parsed: FinalizeAuthenticatorResponse = serde_json::from_str(&body)
        .map_err(|_| SteamError::Auth(format!("FinalizeAddAuthenticator parse error: {}", body)))?;

    let inner = parsed
        .response
        .ok_or_else(|| SteamError::Auth("FinalizeAddAuthenticator: no response field".into()))?;

    Ok(inner.status == Some(1) || inner.success == Some(true))
}

/// Generate a random device ID (like Steam's `BuildRandomId`).
pub fn generate_device_id() -> String {
    use ring::rand::SecureRandom;
    let rng = ring::rand::SystemRandom::new();
    let mut bytes = [0u8; 16];
    let _ = rng.fill(&mut bytes);
    hex_encode(&bytes)
}

fn hex_encode(data: &[u8]) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(data.len() * 2);
    for b in data {
        write!(&mut s, "{:02x}", b).unwrap();
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_device_id() {
        let id = generate_device_id();
        assert_eq!(id.len(), 32); // 16 bytes = 32 hex chars
                                  // Should be different each time
        let id2 = generate_device_id();
        assert_ne!(id, id2);
    }
}
