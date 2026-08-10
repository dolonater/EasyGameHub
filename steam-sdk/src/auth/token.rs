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
/// Calls `IAuthenticationService/GenerateAccessTokenForApp/v1`. Any failure
/// (non-200, missing token) is a hard `Err` — the caller must not silently
/// keep using a stale access token.
pub fn refresh_access_token(
    client: &SteamHttpClient,
    steam_id: u64,
    refresh_token: &str,
) -> Result<String> {
    let url = "https://api.steampowered.com/IAuthenticationService/GenerateAccessTokenForApp/v1/";

    let response = client
        .agent()
        .post(url)
        .send_form(&[
            ("refresh_token", refresh_token),
            ("steamid", &steam_id.to_string()),
        ])
        .map_err(|e| SteamError::Http(format!("RefreshAccessToken failed: {}", e)))?;

    let status = response.status();
    let body = response
        .into_string()
        .map_err(|e| SteamError::Http(format!("RefreshAccessToken read: {}", e)))?;

    if status != 200 {
        let snippet: String = body.chars().take(300).collect();
        return Err(SteamError::Http(format!(
            "RefreshAccessToken failed (status={}): {}",
            status, snippet
        )));
    }

    let parsed: RefreshTokenResponse = serde_json::from_str(&body)?;
    parsed
        .response
        .and_then(|r| r.access_token)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| SteamError::Http("RefreshAccessToken returned no access_token".into()))
}

// ── IsAccessTokenValid ───────────────────────────────────────

// ── JWT helpers ───────────────────────────────────────────────

/// Decode a Steam access token JWT's payload (the second segment).
///
/// Steam access tokens are JWTs. Returns the JSON payload, or `None` if the
/// token isn't a JWT / can't be decoded.
fn decode_jwt_payload(access_token: &str) -> Option<serde_json::Value> {
    if access_token.is_empty() {
        return None;
    }
    let parts: Vec<&str> = access_token.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    let payload_b64 = parts[1].replace('-', "+").replace('_', "/");
    let padded = match payload_b64.len() % 4 {
        2 => format!("{}==", payload_b64),
        3 => format!("{}=", payload_b64),
        _ => payload_b64,
    };
    let payload_bytes = base64_decode(&padded).ok()?;
    serde_json::from_slice(&payload_bytes).ok()
}

/// Extract a Steam access token's `(iat, exp)` claims (both required).
pub fn jwt_timestamps(access_token: &str) -> Option<(u64, u64)> {
    let payload = decode_jwt_payload(access_token)?;
    let iat = payload.get("iat")?.as_u64()?;
    let exp = payload.get("exp")?.as_u64()?;
    Some((iat, exp))
}

/// Check if a Steam access token is still valid by decoding its JWT payload.
///
/// From SteamTools `IsAccessTokenValid(string accessToken)`.
pub fn is_access_token_valid(access_token: &str) -> bool {
    let Some(payload) = decode_jwt_payload(access_token) else {
        return false;
    };
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

    #[test]
    fn test_jwt_timestamps() {
        // base64url payload {"iat":100,"exp":200} → 100 & 200.
        let payload = "eyJpYXQiOjEwMCwiZXhwIjoyMDB9";
        let token = format!("header.{}.sig", payload);
        assert_eq!(jwt_timestamps(&token), Some((100, 200)));
        assert_eq!(jwt_timestamps("not-a-jwt"), None);
    }

    fn base64_encode(s: &str) -> String {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(s.as_bytes())
    }
}
