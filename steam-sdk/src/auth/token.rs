//! Steam token management.
//!
//! Translated from SteamTools `SteamAccountService.cs`:
//! - `FinalizeLoginAsync` → `finalize_login`
//! - `RefreshAccessToken` → `refresh_access_token`
//! - `IsAccessTokenValid` → `is_access_token_valid`
//! - `CheckAccessTokenValidation` → `check_access_token_valid`

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;

// ── FinalizeLogin (from FinalizeLoginAsync) ──────────────────

/// Response from FinalizeLogin.
#[derive(Debug, Clone, Deserialize)]
pub struct FinalizeLoginStatus {
    #[serde(rename = "steamID")]
    pub steam_id: Option<String>,
    #[serde(rename = "transfer_info")]
    pub transfer_info: Option<Vec<TransferInfo>>,
}

/// Transfer info for cross-domain cookie setup.
#[derive(Debug, Clone, Deserialize)]
pub struct TransferInfo {
    pub url: Option<String>,
    pub params: Option<TransferParams>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TransferParams {
    pub nonce: Option<String>,
    pub auth: Option<String>,
}

/// Complete the login by calling `jwt/finalizelogin`.
///
/// From SteamTools `FinalizeLoginAsync(string nonce, string sessionid)`.
/// Uses the refresh_token as the nonce parameter.
pub fn finalize_login(
    client: &SteamHttpClient,
    refresh_token: &str,
    session_id: &str,
) -> Result<Option<FinalizeLoginStatus>> {
    let url = "https://login.steampowered.com/jwt/finalizelogin";

    let response = client
        .agent()
        .post(url)
        .set("Origin", "https://login.steampowered.com")
        .send_form(&[
            ("nonce", refresh_token),
            ("sessionid", session_id),
            ("redir", "https://steamcommunity.com/login/home/?goto="),
        ])
        .map_err(|e| SteamError::Http(format!("FinalizeLogin failed: {}", e)))?;

    if response.status() == 200 {
        let body = response
            .into_string()
            .map_err(|e| SteamError::Http(format!("FinalizeLogin read error: {}", e)))?;
        let status: FinalizeLoginStatus = serde_json::from_str(&body)?;
        Ok(Some(status))
    } else {
        Err(SteamError::Auth(format!(
            "FinalizeLogin failed: HTTP {}",
            response.status()
        )))
    }
}

// ── RefreshAccessToken ───────────────────────────────────────

/// Response from refresh token endpoint.
#[derive(Debug, Clone, Deserialize)]
struct RefreshTokenResponse {
    response: Option<RefreshTokenInner>,
}

#[derive(Debug, Clone, Deserialize)]
struct RefreshTokenInner {
    access_token: Option<String>,
}

/// Refresh an expired access token.
///
/// From SteamTools `RefreshAccessToken(ulong steamId, string refreshToken)`.
/// Calls `IAuthenticationService/GenerateAccessTokenForApp/v1`.
pub fn refresh_access_token(
    client: &SteamHttpClient,
    steam_id: u64,
    refresh_token: &str,
) -> Result<Option<String>> {
    let url = "https://api.steampowered.com/IAuthenticationService/GenerateAccessTokenForApp/v1/";

    let response = client
        .agent()
        .post(url)
        .send_form(&[
            ("refresh_token", refresh_token),
            ("steamid", &steam_id.to_string()),
        ])
        .map_err(|e| SteamError::Http(format!("RefreshAccessToken failed: {}", e)))?;

    if response.status() != 200 {
        return Ok(None);
    }

    let body = response
        .into_string()
        .map_err(|e| SteamError::Http(format!("RefreshAccessToken read: {}", e)))?;

    let parsed: RefreshTokenResponse = serde_json::from_str(&body)?;
    Ok(parsed.response.and_then(|r| r.access_token))
}

// ── IsAccessTokenValid ───────────────────────────────────────

/// Check if a Steam access token is still valid by decoding its JWT payload.
///
/// From SteamTools `IsAccessTokenValid(string accessToken)`.
/// Steam access tokens are JWTs. This function decodes the payload and
/// checks the `exp` (expiration) claim.
pub fn is_access_token_valid(access_token: &str) -> bool {
    if access_token.is_empty() {
        return false;
    }

    let parts: Vec<&str> = access_token.split('.').collect();
    if parts.len() < 3 {
        return false;
    }

    // Decode the JWT payload (second segment)
    let payload_b64 = parts[1].replace('-', "+").replace('_', "/");
    let padded = match payload_b64.len() % 4 {
        2 => format!("{}==", payload_b64),
        3 => format!("{}=", payload_b64),
        _ => payload_b64,
    };

    let payload_bytes = match base64_decode(&padded) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let payload: serde_json::Value = match serde_json::from_slice(&payload_bytes) {
        Ok(v) => v,
        Err(_) => return false,
    };

    // Check exp claim
    if let Some(exp) = payload.get("exp").and_then(|v| v.as_i64()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        return exp > now;
    }

    false
}

/// Validate an access token by making a test API call.
///
/// From SteamTools `CheckAccessTokenValidation(string accesstoken)`.
pub fn check_access_token_valid(client: &SteamHttpClient, access_token: &str) -> Result<bool> {
    let url = format!(
        "https://api.steampowered.com/ISteamWebUserPresenceOAuth/PollStatus/v1/?access_token={}",
        access_token
    );

    let response = client.get(&url)?;
    Ok(response.status() == 200)
}

/// Decode a base64 string (standard, with padding).
fn base64_decode(s: &str) -> std::result::Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("base64 decode: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_access_token_valid_empty() {
        assert!(!is_access_token_valid(""));
    }

    #[test]
    fn test_is_access_token_valid_expired() {
        // Create a JWT with an expired exp claim
        let header = base64_encode(r#"{"alg":"none"}"#);
        let payload = base64_encode(r#"{"exp":1600000000,"sub":"12345"}"#);
        let token = format!("{}.{}.", header, payload);
        assert!(!is_access_token_valid(&token));
    }

    #[test]
    fn test_is_access_token_valid_malformed() {
        assert!(!is_access_token_valid("not-a-jwt"));
        assert!(!is_access_token_valid("a.b"));
    }

    fn base64_encode(s: &str) -> String {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(s.as_bytes())
    }
}
