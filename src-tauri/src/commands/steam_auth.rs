//! Tauri commands for Steam authentication login.
//!
//! Bridges `steam-sdk::auth` to the frontend for password + QR login flows.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use steam_sdk::auth::login;
use steam_sdk::auth::session::{SessionManager, SteamSession};
use steam_sdk::auth::token::refresh_access_token;
use tauri::State;

use crate::commands::steam_api::shared_client;
use crate::AppState;

/// In-memory state for an in-progress login.
static LOGIN_STATE: Mutex<Option<LoginState>> = Mutex::new(None);

struct LoginState {
    client_id: u64,
    request_id: Vec<u8>,
    steam_id: Option<u64>,
    account_name: String,
    interval: f32,
    allowed_confirmations: Vec<login::AllowedConfirmation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStep1Result {
    client_id: u64,
    request_id_hex: String,
    interval_seconds: f64,
    allowed_confirmations: Vec<ConfirmationDto>,
    steam_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmationDto {
    confirmation_type: i32,
    type_name: String,
    associated_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollResultDto {
    status: String, // "pending", "needs_guard", "completed"
    steam_id: Option<u64>,
    account_name: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    new_guard_data: Option<String>,
    login_result: Option<SessionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDto {
    /// SteamID64 as a string — it exceeds JavaScript's safe-integer range
    /// (2^53-1), so sending it as a JSON number would corrupt the value.
    pub steam_id: String,
    pub account_name: String,
    pub access_token: String,
    pub refresh_token: String,
    pub is_active: bool,
}

impl From<SteamSession> for SessionDto {
    fn from(s: SteamSession) -> Self {
        Self {
            steam_id: s.steam_id.to_string(),
            account_name: s.account_name,
            access_token: s.access_token,
            refresh_token: s.refresh_token,
            is_active: s.is_active,
        }
    }
}

fn guard_type_name(t: i32) -> &'static str {
    match t {
        1 => "None",
        2 => "EmailCode",
        3 => "DeviceCode",
        4 => "DeviceConfirmation",
        5 => "EmailConfirmation",
        6 => "MachineToken",
        7 => "LegacyMachineAuth",
        _ => "Unknown",
    }
}

/// Step 1: Submit username + password, get encrypted login session started.
///
/// This does everything: gets RSA key, encrypts password, begins auth session.
/// Returns the client_id + request_id for polling, plus allowed confirmation types.
#[tauri::command]
pub fn login_step1(username: String, password: String) -> Result<LoginStep1Result, String> {
    let client = shared_client();

    // Step 1a: Get RSA public key
    let (modulus, exponent, timestamp) = login::get_password_rsa_key(&client, &username)
        .map_err(|e| format!("Failed to get RSA key: {}", e))?;

    // Step 1b: Encrypt password
    let encrypted = encrypt_password_internal(&password, &modulus, &exponent)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Step 1c: Begin auth session
    let result = login::begin_auth_session_via_credentials(
        &client, &username, &encrypted, timestamp, None, // no guard_data initially
    )
    .map_err(|e| format!("Auth failed: {}", e))?;

    let confirmations: Vec<ConfirmationDto> = result
        .allowed_confirmations
        .iter()
        .map(|c| ConfirmationDto {
            confirmation_type: c.confirmation_type,
            type_name: guard_type_name(c.confirmation_type).into(),
            associated_message: c.associated_message.clone(),
        })
        .collect();

    let state = LoginState {
        client_id: result.client_id,
        request_id: result.request_id.clone(),
        steam_id: result.steamid,
        account_name: username.clone(),
        interval: result.interval.unwrap_or(5.0),
        allowed_confirmations: result.allowed_confirmations.clone(),
    };

    let result_dto = LoginStep1Result {
        client_id: state.client_id,
        request_id_hex: hex_encode(&state.request_id),
        interval_seconds: state.interval as f64,
        allowed_confirmations: confirmations,
        steam_id: state.steam_id,
    };

    *LOGIN_STATE.lock().unwrap() = Some(state);

    

    Ok(result_dto)
}

/// Begin QR code login. Returns the challenge URL for the user to scan.
#[tauri::command]
pub fn login_begin_qr(state: State<AppState>) -> Result<serde_json::Value, String> {
    let _ = &state; // use tool_dir for future session storage
    let client = shared_client();
    let result =
        login::begin_auth_session_via_qr(&client).map_err(|e| format!("QR login failed: {}", e))?;

    let confirmations: Vec<ConfirmationDto> = result
        .allowed_confirmations
        .iter()
        .map(|c| ConfirmationDto {
            confirmation_type: c.confirmation_type,
            type_name: guard_type_name(c.confirmation_type).into(),
            associated_message: c.associated_message.clone(),
        })
        .collect();

    let state = LoginState {
        client_id: result.client_id,
        request_id: result.request_id.clone(),
        steam_id: None,
        account_name: "QR".into(),
        interval: result.interval,
        allowed_confirmations: result.allowed_confirmations.clone(),
    };

    *LOGIN_STATE.lock().unwrap() = Some(state);

    Ok(serde_json::json!({
        "clientId": result.client_id,
        "challengeUrl": result.challenge_url,
        "intervalSeconds": result.interval,
        "version": result.version,
        "allowedConfirmations": confirmations,
    }))
}

/// Step 2: Poll the auth session status.
///
/// Returns "pending" (poll again), "needs_guard" (need SteamGuard code),
/// or "completed" (login successful, session saved).
#[tauri::command]
pub fn login_poll(app_state: State<AppState>) -> Result<PollResultDto, String> {
    let client = shared_client();
    let tool_dir = app_state.tool_dir.clone();
    let mut state_guard = LOGIN_STATE.lock().unwrap();
    let state = state_guard
        .as_ref()
        .ok_or("No active login session. Call login_step1 first.")?;

    let poll = login::poll_auth_session_status(&client, state.client_id, &state.request_id)
        .map_err(|e| format!("Poll failed: {}", e))?;

    match poll {
        login::PollResult::Pending => Ok(PollResultDto {
            status: "pending".into(),
            steam_id: None,
            account_name: None,
            access_token: None,
            refresh_token: None,
            new_guard_data: None,
            login_result: None,
        }),
        // Remote interaction (QR scanned / mobile-app confirmation) means the
        // user acted on another device — keep polling until the tokens land.
        login::PollResult::RemoteInteraction => Ok(PollResultDto {
            status: "pending".into(),
            steam_id: None,
            account_name: None,
            access_token: None,
            refresh_token: None,
            new_guard_data: None,
            login_result: None,
        }),
        login::PollResult::Completed(mut login_result) => {
            // Fix steam_id: prefer the one from step1
            if login_result.steam_id == 0 {
                login_result.steam_id = state.steam_id.unwrap_or(0);
            }
            login_result.account_name = state.account_name.clone();

            // Save session
            let session = SteamSession {
                steam_id: login_result.steam_id,
                account_name: login_result.account_name.clone(),
                access_token: login_result.access_token.clone(),
                refresh_token: login_result.refresh_token.clone(),
                obtained_at: chrono::Utc::now(),
                expires_in_seconds: 3600,
                is_active: true,
            };

            let session_path = session_store_path(&tool_dir);
            let mut mgr = SessionManager::open(&session_path)
                .map_err(|e| format!("Session store error: {}", e))?;
            mgr.upsert_session(session)
                .map_err(|e| format!("Save session error: {}", e))?;

            // Sync the detected steam id into config so Web API commands can
            // address this account without requiring a manual Steam ID.
            if let Ok(mut cfg) = crate::core::config::load_config(&app_state.config_path) {
                cfg.cached_steam_id = login_result.steam_id.to_string();
                let _ = crate::core::config::save_config(&app_state.config_path, &cfg);
            }

            let session_dto = SessionDto {
                steam_id: login_result.steam_id.to_string(),
                account_name: login_result.account_name.clone(),
                access_token: login_result.access_token.clone(),
                refresh_token: login_result.refresh_token.clone(),
                is_active: true,
            };

            // Clear login state
            *state_guard = None;

            Ok(PollResultDto {
                status: "completed".into(),
                steam_id: Some(login_result.steam_id),
                account_name: Some(login_result.account_name),
                access_token: Some(login_result.access_token),
                refresh_token: Some(login_result.refresh_token),
                new_guard_data: login_result.new_guard_data,
                login_result: Some(session_dto),
            })
        }
    }
}

/// Submit a SteamGuard code and continue polling.
#[tauri::command]
pub fn login_submit_guard(code: String, guard_type: i32) -> Result<(), String> {
    let client = shared_client();
    let state_guard = LOGIN_STATE.lock().unwrap();
    let state = state_guard.as_ref().ok_or("No active login session")?;

    login::update_auth_session_with_guard_code(
        &client,
        state.client_id,
        state.steam_id.unwrap_or(0),
        &code,
        guard_type,
    )
    .map_err(|e| format!("Guard code failed: {}", e))?;

    Ok(())
}

/// Get the currently active Steam session.
#[tauri::command]
pub fn get_active_session(app_state: State<AppState>) -> Result<Option<SessionDto>, String> {
    let path = session_store_path(&app_state.tool_dir);
    let _ = refresh_session_if_needed(&path);
    let mgr = SessionManager::open(&path).map_err(|e| format!("Session store error: {}", e))?;
    Ok(mgr.active_session().map(|s| SessionDto::from(s.clone())))
}

/// Return the active session's SteamID64, if any (refreshes the token first).
///
/// Used by community commands (wishlist, profile) to address per-user data.
pub fn active_steam_id(tool_dir: &std::path::Path) -> Option<u64> {
    let path = session_store_path(tool_dir);
    let _ = refresh_session_if_needed(&path);
    let mgr = SessionManager::open(&path).ok()?;
    mgr.active_session().map(|s| s.steam_id)
}

/// Refresh the access token if it is about to expire.
///
/// Failures are downgraded to a no-op so a stale-but-present session never
/// blocks the UI. Only the access token is replaced; the refresh token and
/// identity are kept, and the expiry clock restarts from now.
fn refresh_session_if_needed(path: &std::path::Path) -> Result<(), String> {
    let mut mgr = SessionManager::open(path).map_err(|e| format!("Session store error: {}", e))?;
    let Some(session) = mgr.active_session().cloned() else {
        return Ok(());
    };
    if !session.is_expired() || session.refresh_token.is_empty() {
        return Ok(());
    }

    let client = shared_client();
    let new_token = refresh_access_token(&client, session.steam_id, &session.refresh_token)
        .map_err(|e| format!("Token refresh failed: {}", e))?;

    if let Some(access_token) = new_token {
        let mut refreshed = session;
        refreshed.access_token = access_token;
        refreshed.obtained_at = chrono::Utc::now();
        mgr.upsert_session(refreshed)
            .map_err(|e| format!("Save session error: {}", e))?;
    }
    Ok(())
}

/// Log out: remove the active session.
#[tauri::command]
pub fn logout(app_state: State<AppState>) -> Result<(), String> {
    let path = session_store_path(&app_state.tool_dir);
    let mut mgr = SessionManager::open(&path).map_err(|e| format!("Session store error: {}", e))?;
    if let Some(session) = mgr.active_session() {
        let steam_id = session.steam_id;
        mgr.remove_session(steam_id)
            .map_err(|e| format!("Logout error: {}", e))?;
    }
    Ok(())
}

fn session_store_path(tool_dir: &std::path::Path) -> std::path::PathBuf {
    tool_dir.join("steam_sessions.enc.json")
}

/// Delegate to steam-sdk's encrypt_password.
fn encrypt_password_internal(p: &str, m: &str, e: &str) -> Result<String, String> {
    steam_sdk::auth::login::encrypt_password(p, m, e).map_err(|e| format!("RSA encrypt: {}", e))
}

fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect()
}
