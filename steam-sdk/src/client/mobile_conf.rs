//! Steam mobile confirmation client (`steamcommunity.com/mobileconf`).
//!
//! Lists pending Steam Guard / trade / login confirmations and responds to
//! them. Requires a logged-in session (access token), the account's
//! `identity_secret` + `device_id` (from a maFile-backed auth entry), and a
//! persistent per-account `session_id` cookie value.

use crate::client::SteamHttpClient;
use crate::crypto::mobile_conf::{build_action_url, build_getlist_url, generate_confirmation_key};
use crate::error::{Result, SteamError};
use serde::Deserialize;

/// A pending confirmation returned by the mobileconf list endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct RawConfirmation {
    /// Confirmation ID (`cid` param for allow/deny).
    pub id: String,
    /// Confirmation key (`ck` param for allow/deny — taken from this response).
    pub key: String,
    /// Confirmation kind: 2 = trade, 3 = market, 1 = guard/login, etc.
    #[serde(rename = "type")]
    pub kind: i32,
    /// Trade offer / creator ID, when present.
    pub creator_id: String,
    /// Creator identifier (steamid64 for trades).
    pub creator: String,
    /// Human-readable detail text from Steam.
    pub details: String,
}

#[derive(Debug, Deserialize)]
struct GetListResponse {
    success: bool,
    #[serde(default)]
    conf: Vec<RawConfirmation>,
}

#[derive(Debug, Deserialize)]
struct ActionResponse {
    success: bool,
}

/// Current unix time adjusted by the entry's clock offset.
fn adjusted_time(time_offset: i64) -> u64 {
    (chrono::Utc::now().timestamp() + time_offset).max(0) as u64
}

/// Fetch the pending confirmations for the account.
///
/// `time_offset` is the authenticator entry's clock-skew correction.
pub fn get_pending(
    client: &SteamHttpClient,
    access_token: &str,
    session_id: &str,
    device_id: &str,
    steam_id: u64,
    identity_secret: &[u8],
    time_offset: i64,
) -> Result<Vec<RawConfirmation>> {
    let time = adjusted_time(time_offset);
    let conf_key = generate_confirmation_key(identity_secret, "conf", time);
    let url = build_getlist_url(device_id, steam_id, &conf_key, time, access_token);

    let cookie = format!("sessionid={}", session_id);
    let response = request(client, &url, &cookie)?;
    let parsed: GetListResponse = response.into_json()?;
    if !parsed.success {
        return Err(SteamError::ApiError {
            code: -1,
            message: "mobileconf/getlist returned success=false".into(),
        });
    }
    Ok(parsed.conf)
}

/// Confirm (`allow`) or reject (`deny`) a single confirmation.
///
/// `confirmation_id` / `confirmation_key` come from a [`RawConfirmation`]
/// returned by [`get_pending`].
pub fn respond(
    client: &SteamHttpClient,
    access_token: &str,
    session_id: &str,
    device_id: &str,
    steam_id: u64,
    identity_secret: &[u8],
    time_offset: i64,
    action: &str,
    confirmation_id: &str,
    confirmation_key: &str,
) -> Result<()> {
    let time = adjusted_time(time_offset);
    let conf_key = generate_confirmation_key(identity_secret, "conf", time);
    let url = build_action_url(
        action,
        device_id,
        steam_id,
        &conf_key,
        time,
        confirmation_id,
        confirmation_key,
        access_token,
    );

    let cookie = format!("sessionid={}", session_id);
    let response = request(client, &url, &cookie)?;
    let parsed: ActionResponse = response.into_json()?;
    if !parsed.success {
        return Err(SteamError::ApiError {
            code: -1,
            message: format!("mobileconf/{} returned success=false", action),
        });
    }
    Ok(())
}

/// Perform the GET with the session cookie; map a 403 (expired session) to a
/// clearer error.
fn request(client: &SteamHttpClient, url: &str, cookie: &str) -> Result<crate::client::SteamResponse> {
    match client.get_with_headers_ureq(url, &[("Cookie", cookie)]) {
        Ok(resp) => Ok(resp),
        Err(ureq::Error::Status(403, _)) => Err(SteamError::Auth(
            "Steam session expired, please log in again".into(),
        )),
        Err(e) => Err(SteamError::Http(format!("GET {} failed: {}", url, e))),
    }
}
