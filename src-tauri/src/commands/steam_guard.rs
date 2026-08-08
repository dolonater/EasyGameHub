//! Tauri commands for Steam Guard: mobile confirmations + maFile export.
//!
//! Bridges `steam-sdk::client::mobile_conf` (list / allow / deny) and the
//! stored authenticator entries to the frontend. Confirmations operate on the
//! **active Steam session** matched to an `AuthEntry` whose `steam_id` equals
//! the session's — that entry supplies `identity_secret` / `device_id` /
//! `time_offset` needed to sign the mobileconf requests.

use serde::Serialize;
use steam_sdk::auth::session::SessionManager;
use steam_sdk::client::mobile_conf;
use steam_sdk::crypto::authenticator::{AuthEntryManager, TokenTypeSerde};
use steam_sdk::crypto::mobile_conf::session_id_from_device_id;
use tauri::State;

use crate::commands::authenticator::store_path;
use crate::commands::steam_api::shared_client;
use crate::commands::steam_auth::{refresh_session_if_needed, session_store_path};
use crate::AppState;

/// A pending confirmation surfaced to the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingConfirmationDto {
    /// Confirmation ID (`cid`).
    pub id: String,
    /// Confirmation key (`ck`, taken from the getlist response).
    pub key: String,
    /// `trade` | `market` | `guard` | `other` — derived from the Steam type.
    pub kind: String,
    /// Human-readable detail text from Steam.
    pub description: String,
}

/// Everything needed to sign a mobileconf request, resolved once per call.
struct MobileConfContext {
    access_token: String,
    session_id: String,
    device_id: String,
    steam_id: u64,
    identity_secret: Vec<u8>,
    time_offset: i64,
}

/// List the pending confirmations for the active session's bound account.
#[tauri::command]
pub fn get_pending_confirmations(
    state: State<AppState>,
) -> Result<Vec<PendingConfirmationDto>, String> {
    let ctx = resolve_mobile_conf_context(&state.tool_dir)?;
    let client = shared_client();
    let raws = mobile_conf::get_pending(
        &client,
        &ctx.access_token,
        &ctx.session_id,
        &ctx.device_id,
        ctx.steam_id,
        &ctx.identity_secret,
        ctx.time_offset,
    )
    .map_err(|e| e.to_string())?;

    Ok(raws
        .into_iter()
        .map(|r| PendingConfirmationDto {
            id: r.id,
            key: r.key,
            kind: confirmation_kind_name(r.kind).to_string(),
            description: r.details,
        })
        .collect())
}

/// Confirm (`action = "allow"`) or reject (`action = "deny"`) a confirmation.
#[tauri::command]
pub fn respond_confirmation(
    state: State<AppState>,
    confirmation_id: String,
    key: String,
    action: String,
) -> Result<(), String> {
    if action != "allow" && action != "deny" {
        return Err(format!("invalid confirmation action: {}", action));
    }
    let ctx = resolve_mobile_conf_context(&state.tool_dir)?;
    let client = shared_client();
    mobile_conf::respond(
        &client,
        &ctx.access_token,
        &ctx.session_id,
        &ctx.device_id,
        ctx.steam_id,
        &ctx.identity_secret,
        ctx.time_offset,
        &action,
        &confirmation_id,
        &key,
    )
    .map_err(|e| e.to_string())
}

/// Rebuild a Steam `.maFile` JSON from a stored authenticator entry.
///
/// Returns the JSON content; the frontend lets the user pick a path to write.
/// Only Steam-type entries can be exported.
#[tauri::command]
pub fn export_mafile(state: State<AppState>, entry_id: String) -> Result<String, String> {
    use base64::Engine;
    let path = store_path(&state.tool_dir);
    let mgr = AuthEntryManager::open(&path).map_err(|e| e.to_string())?;
    let entry = mgr
        .get_entry(&entry_id)
        .ok_or_else(|| "验证器条目不存在".to_string())?;

    if entry.token_type != TokenTypeSerde::Steam {
        return Err("仅 Steam 类型条目可导出 maFile".to_string());
    }

    let encode64 = |bytes: &[u8]| base64::engine::general_purpose::STANDARD.encode(bytes);
    let identity = if entry.identity_secret_encrypted.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::Value::String(encode64(&entry.identity_secret_encrypted))
    };

    let json = serde_json::json!({
        "shared_secret": encode64(&entry.secret_encrypted),
        "identity_secret": identity,
        "serial_number": entry.serial_number,
        "revocation_code": entry.revocation_code,
        "device_id": entry.device_id,
        "steam_id": entry.steam_id,
        "account_name": entry.account_name,
        "status": if entry.is_active { 1 } else { 0 },
    });

    serde_json::to_string_pretty(&json).map_err(|e| e.to_string())
}

// ── Helpers ──────────────────────────────────────────────────

/// Steam mobile confirmation type → UI kind.
/// 1 = generic (login / guard / removal), 2 = trade, 3 = market sell.
fn confirmation_kind_name(kind: i32) -> &'static str {
    match kind {
        2 => "trade",
        3 => "market",
        1 => "guard",
        _ => "other",
    }
}

/// Resolve the active session + its bound authenticator entry into the
/// parameters the mobileconf client needs. Fails with a user-facing message
/// when not logged in, no matching entry exists, or secrets are missing.
fn resolve_mobile_conf_context(tool_dir: &std::path::Path) -> Result<MobileConfContext, String> {
    let session_path = session_store_path(tool_dir);
    let _ = refresh_session_if_needed(&session_path);
    let mgr = SessionManager::open(&session_path)
        .map_err(|e| format!("会话存储错误: {}", e))?;
    let session = mgr
        .active_session()
        .ok_or_else(|| "未登录 Steam，请先在 Steam 页面登录".to_string())?;

    let amgr = AuthEntryManager::open(&store_path(tool_dir))
        .map_err(|e| format!("验证器存储错误: {}", e))?;
    let steam_id_str = session.steam_id.to_string();
    let entry = amgr
        .all_entries()
        .iter()
        .find(|e| {
            e.token_type == TokenTypeSerde::Steam
                && e.steam_id.as_deref() == Some(steam_id_str.as_str())
        })
        .ok_or_else(|| {
            "该账号未绑定 Steam 验证器（maFile），请先在「认证器」页导入对应账号的 maFile".to_string()
        })?;

    let device_id = entry
        .device_id
        .clone()
        .ok_or_else(|| "该验证器缺少 device_id，请重新导入 maFile".to_string())?;
    if entry.identity_secret_encrypted.is_empty() {
        return Err("该验证器缺少身份密钥（identity_secret），请重新导入 maFile".to_string());
    }

    Ok(MobileConfContext {
        access_token: session.access_token.clone(),
        session_id: session_id_from_device_id(&device_id),
        device_id,
        steam_id: session.steam_id,
        identity_secret: entry.identity_secret_encrypted.clone(),
        time_offset: entry.time_offset,
    })
}
