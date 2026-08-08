//! Steam authentication login flows.
//!
//! Implements password-based login and QR code login using the
//! Steam Web API authentication service (protobuf-based).

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use crate::proto_gen::*;

use prost::Message;
use rsa::pkcs1v15::EncryptingKey;
use rsa::traits::RandomizedEncryptor;
use rsa::RsaPublicKey;

/// URL base for Steam authentication API.
const AUTH_API_BASE: &str = "https://api.steampowered.com/IAuthenticationService";

/// Result of a successful login.
#[derive(Debug, Clone)]
pub struct LoginResult {
    pub steam_id: u64,
    pub account_name: String,
    pub access_token: String,
    pub refresh_token: String,
    pub new_guard_data: Option<String>,
}

/// Acquire an RSA public key for encrypting the password.
///
/// Calls `GetPasswordRSAPublicKey/v1` and returns the hex-encoded modulus
/// and exponent, plus a timestamp used to associate the encryption with
/// a specific key version.
pub fn get_password_rsa_key(
    client: &SteamHttpClient,
    account_name: &str,
) -> Result<(String, String, u64)> {
    let request = CAuthenticationGetPasswordRsaPublicKeyRequest {
        account_name: Some(account_name.to_string()),
    };

    let request_bytes = request.encode_to_vec();
    let base64_encoded = base64_encode(&request_bytes);
    let encoded = url_encode(base64_encoded.as_bytes());

    let url = format!(
        "{}/GetPasswordRSAPublicKey/v1?input_protobuf_encoded={}",
        AUTH_API_BASE, encoded
    );

    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(SteamError::Auth(format!(
            "Failed to get RSA key: HTTP {}",
            response.status()
        )));
    }

    let body = response.into_vec()?;
    let result = CAuthenticationGetPasswordRsaPublicKeyResponse::decode(body.as_slice())?;

    let modulus = result
        .publickey_mod
        .ok_or_else(|| SteamError::Auth("No public key modulus in response".into()))?;
    let exponent = result
        .publickey_exp
        .ok_or_else(|| SteamError::Auth("No public key exponent in response".into()))?;
    let timestamp = result.timestamp.unwrap_or(0);

    Ok((modulus, exponent, timestamp))
}

/// Encrypt a password using the RSA public key from Steam's response.
///
/// Uses PKCS#1 v1.5 padding (matching Steam's client behavior).
/// The modulus and exponent are hex-encoded strings as returned by
/// the Steam API.
pub fn encrypt_password(password: &str, modulus_hex: &str, exponent_hex: &str) -> Result<String> {
    let modulus = hex_decode(modulus_hex)
        .map_err(|e| SteamError::Crypto(format!("Failed to decode RSA modulus: {}", e)))?;
    let exponent = hex_decode(exponent_hex)
        .map_err(|e| SteamError::Crypto(format!("Failed to decode RSA exponent: {}", e)))?;

    // Build RSA public key from n and e (PKCS1 style)
    let public_key = RsaPublicKey::new(
        rsa::BigUint::from_bytes_be(&modulus),
        rsa::BigUint::from_bytes_be(&exponent),
    )
    .map_err(|e| SteamError::Crypto(format!("Invalid RSA public key: {}", e)))?;

    let encrypting_key = EncryptingKey::new(public_key);
    let encrypted = encrypting_key
        .encrypt_with_rng(&mut rand::thread_rng(), password.as_bytes())
        .map_err(|e| SteamError::Crypto(format!("RSA encryption failed: {}", e)))?;

    Ok(base64_encode(&encrypted))
}

/// Begin an authentication session with a username and encrypted password.
///
/// Returns the client_id and request_id needed for polling, plus any
/// allowed confirmation types (e.g. SteamGuard, email).
pub fn begin_auth_session_via_credentials(
    client: &SteamHttpClient,
    account_name: &str,
    encrypted_password: &str,
    encryption_timestamp: u64,
    guard_data: Option<&str>,
) -> Result<BeginAuthCredentialsResult> {
    let request = CAuthenticationBeginAuthSessionViaCredentialsRequest {
        device_friendly_name: Some("Steam SDK (Rust)".to_string()),
        account_name: Some(account_name.to_string()),
        encrypted_password: Some(encrypted_password.to_string()),
        encryption_timestamp: Some(encryption_timestamp),
        remember_login: Some(true),
        platform_type: Some(EAuthTokenPlatformType::KEAuthTokenPlatformTypeWebBrowser as i32),
        persistence: Some(ESessionPersistence::KESessionPersistencePersistent as i32),
        website_id: None,
        device_details: None,
        guard_data: guard_data.map(|s| s.to_string()),
        language: None,
        qos_level: None,
    };

    let request_bytes = request.encode_to_vec();

    let url = format!("{}/BeginAuthSessionViaCredentials/v1", AUTH_API_BASE);
    let response = client.post_protobuf_form(&url, &request_bytes)?;

    if response.status() != 200 {
        return Err(SteamError::Auth(format!(
            "Auth request failed: HTTP {}",
            response.status()
        )));
    }

    let body = response.into_vec()?;
    let result = CAuthenticationBeginAuthSessionViaCredentialsResponse::decode(body.as_slice())?;

    let client_id = result
        .client_id
        .ok_or_else(|| SteamError::Auth("No client_id in auth response".into()))?;
    let request_id = result
        .request_id
        .ok_or_else(|| SteamError::Auth("No request_id in auth response".into()))?;

    let allowed_confirmations: Vec<AllowedConfirmation> = result
        .allowed_confirmations
        .iter()
        .map(|c| AllowedConfirmation {
            confirmation_type: c.confirmation_type.unwrap_or(0),
            associated_message: c.associated_message.clone(),
        })
        .collect();

    // Web-browser logins only dispatch the Steam Guard email code after the
    // client confirms the device via `/jwt/checkdevice/{steamid}`. Do it now
    // so the code is actually in the account inbox before the UI prompts for
    // it. Without this the auth session waits forever and no email arrives.
    if let Some(steam_id) = result.steamid {
        let needs_email_code = allowed_confirmations
            .iter()
            .any(|c| c.confirmation_type == 2); // k_EAuthSessionGuardType_EmailCode
        if needs_email_code {
            check_device_for_email(client, steam_id, client_id)?;
        }
    }

    Ok(BeginAuthCredentialsResult {
        client_id,
        request_id,
        steamid: result.steamid,
        weak_token: result.weak_token,
        interval: result.interval,
        allowed_confirmations,
        extended_error_message: result.extended_error_message,
    })
}

/// Trigger Steam to send the email verification code for a web-login auth
/// session.
///
/// Steam's `IAuthenticationService` flow with `platform_type = WebBrowser`
/// only dispatches the email code after the client registers the auth session
/// with `/jwt/checkdevice/{steamid}`. Called right after a session is begun
/// when the allowed confirmations include an email code.
pub fn check_device_for_email(
    client: &SteamHttpClient,
    steam_id: u64,
    client_id: u64,
) -> Result<()> {
    let client_id_str = client_id.to_string();
    let steam_id_str = steam_id.to_string();
    let url = format!(
        "https://login.steampowered.com/jwt/checkdevice/{}",
        steam_id
    );
    let response =
        client.post_form(&url, &[("clientid", &client_id_str), ("steamid", &steam_id_str)])?;

    let status = response.status();
    let body = response.into_string()?;
    if status != 200 {
        return Err(SteamError::Auth(format!(
            "Check device failed: HTTP {} ({})",
            status, body
        )));
    }

    // Steam answers 200 even for a brand-new device that still needs email
    // verification (e.g. `{"success":false,"result":8}`) — and in that case
    // the email code *is* dispatched. The HTTP status is the only reliable
    // signal, matching the reference client (SteamTools only checks it).
    // Treat `success:false` as informational, not as an error.
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
        if !json["success"].as_bool().unwrap_or(true) {
            let result = json["result"].as_i64().unwrap_or(0);
            log::debug!("checkdevice: success=false result={} (email still sent)", result);
        }
    }

    Ok(())
}

/// Poll the authentication session status.
///
/// Called repeatedly until the session completes. Returns `None` if
/// polling should continue, or `Some(LoginResult)` if authentication
/// completed successfully.
pub fn poll_auth_session_status(
    client: &SteamHttpClient,
    client_id: u64,
    request_id: &[u8],
) -> Result<PollResult> {
    let request = CAuthenticationPollAuthSessionStatusRequest {
        client_id: Some(client_id),
        request_id: Some(request_id.to_vec()),
        token_to_revoke: None,
    };

    let request_bytes = request.encode_to_vec();
    let url = format!("{}/PollAuthSessionStatus/v1", AUTH_API_BASE);
    let response = client.post_protobuf_form(&url, &request_bytes)?;

    if response.status() != 200 {
        return Err(SteamError::Auth(format!(
            "Poll request failed: HTTP {}",
            response.status()
        )));
    }

    let body = response.into_vec()?;
    let result = CAuthenticationPollAuthSessionStatusResponse::decode(body.as_slice())?;

    if let (Some(access_token), Some(refresh_token)) = (result.access_token, result.refresh_token) {
        // Authentication completed successfully. The poll response does NOT
        // carry a SteamID64 (its `new_client_id` is a session id, not the
        // account), so the authoritative steamid is read from the access
        // token's JWT `sub` claim — present for both QR and credentials flows.
        let login_result = LoginResult {
            steam_id: extract_steam_id_from_jwt(&access_token),
            account_name: result.account_name.unwrap_or_default(),
            access_token,
            refresh_token,
            new_guard_data: result.new_guard_data,
        };
        Ok(PollResult::Completed(login_result))
    } else if result.had_remote_interaction.unwrap_or(false) {
        Ok(PollResult::RemoteInteraction)
    } else {
        Ok(PollResult::Pending)
    }
}

/// Extract the account SteamID64 from an access token JWT's `sub` claim.
fn extract_steam_id_from_jwt(access_token: &str) -> u64 {
    let payload = access_token.split('.').nth(1).unwrap_or("");
    let Some(decoded) = base64url_decode(payload) else {
        return 0;
    };
    serde_json::from_slice::<serde_json::Value>(&decoded)
        .ok()
        .and_then(|v| v.get("sub").cloned())
        .and_then(|s| s.as_str().map(String::from))
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0)
}

/// Base64url decode (JWT encoding: no padding, `-`/`_` in place of `+`/`/`).
fn base64url_decode(input: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    let mut b64 = input.replace('-', "+").replace('_', "/");
    while b64.len() % 4 != 0 {
        b64.push('=');
    }
    base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()).ok()
}

/// Send a SteamGuard code to complete authentication.
pub fn update_auth_session_with_guard_code(
    client: &SteamHttpClient,
    client_id: u64,
    steam_id: u64,
    code: &str,
    guard_type: i32,
) -> Result<()> {
    // Steam uses a different endpoint for updating with guard code.
    // `steamid` must be the account's SteamID64 from the begin-session
    // response, or Steam rejects the submitted code.
    let request = CAuthenticationUpdateAuthSessionWithSteamGuardCodeRequest {
        client_id: Some(client_id),
        steamid: Some(steam_id),
        code: Some(code.to_string()),
        code_type: Some(guard_type),
    };

    let request_bytes = request.encode_to_vec();
    let url = format!("{}/UpdateAuthSessionWithSteamGuardCode/v1", AUTH_API_BASE);
    // Steam's IAuthenticationService endpoints expect the base64 protobuf in a
    // form field (same as begin/poll), not a raw octet-stream body.
    let response = client.post_protobuf_form(&url, &request_bytes)?;

    if response.status() == 200 {
        Ok(())
    } else {
        Err(SteamError::Auth(format!(
            "Guard code update failed: HTTP {}",
            response.status()
        )))
    }
}

// --- QR code login ---

/// Begin an authentication session via QR code.
///
/// Returns the client_id, request_id, and the QR challenge URL that should
/// be displayed to the user (or opened in the Steam mobile app).
pub fn begin_auth_session_via_qr(client: &SteamHttpClient) -> Result<BeginQrResult> {
    let request = CAuthenticationBeginAuthSessionViaQrRequest {
        device_friendly_name: Some("Steam SDK (Rust)".to_string()),
        platform_type: Some(EAuthTokenPlatformType::KEAuthTokenPlatformTypeMobileApp as i32),
        device_details: None,
        website_id: None,
    };

    let request_bytes = request.encode_to_vec();

    let url = format!("{}/BeginAuthSessionViaQR/v1", AUTH_API_BASE);

    let response = client.post_protobuf_form(&url, &request_bytes)?;
    let status = response.status();
    let body = response.into_vec()?;

    if status != 200 {
        let text = String::from_utf8_lossy(&body);
        return Err(SteamError::Auth(format!(
            "QR auth failed (HTTP {}): {}",
            status, text
        )));
    }

    let result =
        CAuthenticationBeginAuthSessionViaQrResponse::decode(body.as_slice()).map_err(|_| {
            let text = String::from_utf8_lossy(&body);
            SteamError::Auth(format!("QR auth protobuf decode failed: {}", text))
        })?;

    Ok(BeginQrResult {
        client_id: result.client_id.unwrap_or(0),
        request_id: result.request_id.unwrap_or_default(),
        challenge_url: result.challenge_url.unwrap_or_default(),
        interval: result.interval.unwrap_or(5.0),
        version: result.version.unwrap_or(1),
        allowed_confirmations: result
            .allowed_confirmations
            .iter()
            .map(|c| AllowedConfirmation {
                confirmation_type: c.confirmation_type.unwrap_or(0),
                associated_message: c.associated_message.clone(),
            })
            .collect(),
    })
}

/// Result from `begin_auth_session_via_qr`.
#[derive(Debug, Clone)]
pub struct BeginQrResult {
    pub client_id: u64,
    pub request_id: Vec<u8>,
    pub challenge_url: String,
    pub interval: f32,
    pub version: i32,
    pub allowed_confirmations: Vec<AllowedConfirmation>,
}

// --- Helper types ---

/// Result from `begin_auth_session_via_credentials`.
#[derive(Debug, Clone)]
pub struct BeginAuthCredentialsResult {
    pub client_id: u64,
    pub request_id: Vec<u8>,
    pub steamid: Option<u64>,
    pub weak_token: Option<String>,
    pub interval: Option<f32>,
    pub allowed_confirmations: Vec<AllowedConfirmation>,
    pub extended_error_message: Option<String>,
}

/// A confirmation type allowed for this authentication session.
#[derive(Debug, Clone)]
pub struct AllowedConfirmation {
    pub confirmation_type: i32,
    pub associated_message: Option<String>,
}

/// Result from a single poll attempt.
#[derive(Debug, Clone)]
pub enum PollResult {
    /// Still waiting — poll again after the interval.
    Pending,
    /// User interacted remotely (QR scan, mobile confirm).
    RemoteInteraction,
    /// Authentication completed successfully.
    Completed(LoginResult),
}

// --- Internal helpers ---

/// URL-encode bytes for the Steam API query parameter format.
fn url_encode(data: &[u8]) -> String {
    // Steam uses a slightly custom encoding: URL-safe but with
    // percent-encoding for non-ASCII bytes.
    let mut result = String::new();
    for &byte in data {
        if byte.is_ascii_alphanumeric()
            || byte == b'-'
            || byte == b'_'
            || byte == b'.'
            || byte == b'~'
        {
            result.push(byte as char);
        } else {
            result.push_str(&format!("%{:02X}", byte));
        }
    }
    result
}

/// Decode a hex string to bytes.
fn hex_decode(s: &str) -> std::result::Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("odd hex string length".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16)
                .map_err(|e| format!("invalid hex at position {}: {}", i, e))
        })
        .collect()
}

/// Base64-encode bytes (standard encoding).
fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_decode() {
        let result = hex_decode("010001").unwrap();
        assert_eq!(result, vec![1, 0, 1]);
    }

    #[test]
    fn test_url_encode() {
        let result = url_encode(b"test");
        assert_eq!(result, "test");

        // Non-alphanumeric should be percent-encoded
        let result = url_encode(&[0x00, 0xFF]);
        assert_eq!(result, "%00%FF");
    }

    #[test]
    fn test_encrypt_password_format() {
        // Test that we can create an RSA key and encrypt
        let mut rng = rand::thread_rng();
        use rsa::traits::PublicKeyParts;
        use rsa::RsaPrivateKey;
        let private_key = RsaPrivateKey::new(&mut rng, 1024).expect("failed to generate test key");
        let public_key = RsaPublicKey::from(&private_key);

        let modulus_hex = hex_encode(&public_key.n().to_bytes_be());
        let exponent_hex = hex_encode(&public_key.e().to_bytes_be());

        // Encrypt with our function
        let encrypted = encrypt_password("test_password", &modulus_hex, &exponent_hex).unwrap();

        // Should be non-empty base64
        assert!(!encrypted.is_empty());
        assert!(base64_decode(&encrypted).is_ok());
    }

    #[test]
    fn extracts_steam_id_from_access_token() {
        use base64::Engine;
        let payload = r#"{"iss":"r:test","sub":"76561198372706082","aud":["web"]}"#;
        let enc = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(payload);
        let token = format!("header.{}.sig", enc);
        assert_eq!(super::extract_steam_id_from_jwt(&token), 76561198372706082);
    }

    #[test]
    fn jwt_without_sub_is_zero() {
        assert_eq!(super::extract_steam_id_from_jwt("not-a-jwt"), 0);
        assert_eq!(super::extract_steam_id_from_jwt("a.b.c"), 0);
        assert_eq!(super::extract_steam_id_from_jwt(""), 0);
    }

    fn hex_encode(data: &[u8]) -> String {
        data.iter().map(|b| format!("{:02x}", b)).collect()
    }

    fn base64_decode(s: &str) -> std::result::Result<Vec<u8>, String> {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(s)
            .map_err(|e| e.to_string())
    }
}
