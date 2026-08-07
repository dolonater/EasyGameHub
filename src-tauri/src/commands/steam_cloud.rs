//! Tauri commands for local Steam cloud storage.

use base64::Engine;
use tauri::command;

use crate::core::steam_cloud;

const ERR_STEAM_NOT_RUNNING: &str = "STEAM_CLOUD_STEAM_NOT_RUNNING";
const ERR_CONNECT_FAILED: &str = "STEAM_CLOUD_CONNECT_FAILED";
const ERR_NOT_SUPPORTED: &str = "STEAM_CLOUD_NOT_SUPPORTED";
const ERR_UNAVAILABLE: &str = "STEAM_CLOUD_UNAVAILABLE";
const ERR_READ_FAILED: &str = "STEAM_CLOUD_READ_FAILED";
const ERR_WRITE_FAILED: &str = "STEAM_CLOUD_WRITE_FAILED";
const ERR_DELETE_FAILED: &str = "STEAM_CLOUD_DELETE_FAILED";

enum CloudOp {
    Read,
    Write,
    Delete,
    ReadMeta,
}

fn map_cloud_error(error: String, op: CloudOp) -> String {
    let normalized = error.to_lowercase();

    if normalized.contains("no active steam user")
        || normalized.contains("failed to connect to global steam user")
    {
        return ERR_STEAM_NOT_RUNNING.into();
    }

    if normalized.contains("steam installation not found")
        || normalized.contains("steamclient64.dll not found")
        || normalized.contains("failed to load steamclient64.dll")
        || normalized.contains("failed to create steam pipe")
        || normalized.contains("failed to acquire steamremotestorage")
        || normalized.contains("steam app context mismatch")
    {
        return ERR_CONNECT_FAILED.into();
    }

    if normalized.contains("not supported") {
        return ERR_NOT_SUPPORTED.into();
    }

    match op {
        CloudOp::ReadMeta => ERR_UNAVAILABLE.into(),
        CloudOp::Read => ERR_READ_FAILED.into(),
        CloudOp::Write => ERR_WRITE_FAILED.into(),
        CloudOp::Delete => ERR_DELETE_FAILED.into(),
    }
}

#[command]
pub fn get_local_cloud_files(app_id: u32) -> Result<Vec<steam_cloud::LocalCloudFile>, String> {
    steam_cloud::get_files(app_id).map_err(|e| map_cloud_error(e, CloudOp::ReadMeta))
}

#[command]
pub fn get_local_cloud_quota(app_id: u32) -> Result<steam_cloud::LocalCloudQuota, String> {
    steam_cloud::get_quota(app_id).map_err(|e| map_cloud_error(e, CloudOp::ReadMeta))
}

#[command]
pub fn get_local_cloud_entries(app_id: u32) -> Result<Vec<steam_cloud::LocalCloudEntry>, String> {
    steam_cloud::get_entries(app_id).map_err(|e| map_cloud_error(e, CloudOp::ReadMeta))
}

#[command]
pub fn read_local_cloud_file(app_id: u32, filename: String) -> Result<String, String> {
    let bytes =
        steam_cloud::read_file(app_id, &filename).map_err(|e| map_cloud_error(e, CloudOp::Read))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[command]
pub fn write_local_cloud_file(
    app_id: u32,
    filename: String,
    data_base64: String,
) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| format!("Base64 decode: {}", e))?;
    steam_cloud::write_file(app_id, &filename, &bytes)
        .map_err(|e| map_cloud_error(e, CloudOp::Write))
}

#[command]
pub fn delete_local_cloud_file(app_id: u32, filename: String) -> Result<(), String> {
    steam_cloud::delete_file(app_id, &filename).map_err(|e| map_cloud_error(e, CloudOp::Delete))
}
