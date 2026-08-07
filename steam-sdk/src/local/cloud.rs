//! Local Steam cloud storage operations.
//!
//! Phase 2 uses Steam's local userdata cache (`remotecache.vdf` + `remote/`)
//! and app metadata to remove the API-key dependency from read-only cloud
//! views. Phase 3 adds direct local `ISteamRemoteStorage` read/write/delete
//! access on Windows, matching the SteamTools direction.

use crate::client::cloud::discover_local_cloud_saves;
use crate::error::{Result, SteamError};
use crate::local::steam_path::detect_steam;
use crate::local::steam_service::parse_appinfo_vdf;
use crate::local::switcher::current_user;
use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use std::ffi::{c_char, c_void, CString};
#[cfg(target_os = "windows")]
use std::ptr;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{FreeLibrary, GetLastError, HMODULE};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::LibraryLoader::{
    GetProcAddress, LoadLibraryExA, LOAD_WITH_ALTERED_SEARCH_PATH,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalCloudFile {
    pub filename: String,
    pub size: u64,
    pub timestamp: u64,
    pub exists: bool,
    pub persisted: bool,
    pub sync_platforms: i32,
    pub sha_file: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalCloudQuota {
    pub total_bytes: u64,
    pub used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalCloudEntry {
    pub filename: String,
    pub remote_size: Option<u64>,
    pub remote_timestamp: Option<u64>,
    pub local_size: u64,
    pub local_timestamp: u64,
    pub local_is_newer: bool,
    pub url: Option<String>,
}

fn unavailable() -> SteamError {
    SteamError::General("Local Steam cloud storage is not implemented yet".into())
}

fn current_steam_id32() -> Result<u32> {
    current_user()?
        .map(|user| (user.steam_id64 & 0xFFFF_FFFF) as u32)
        .ok_or_else(|| {
            SteamError::NotFound("No active Steam user found. Please log in to Steam first.".into())
        })
}

fn app_quota_bytes(app_id: u32) -> Result<Option<u64>> {
    let install = detect_steam()?;
    let apps = parse_appinfo_vdf(&install.path)?;
    Ok(apps
        .into_iter()
        .find(|app| app.app_id == app_id)
        .and_then(|app| app.cloud_quota_bytes))
}

pub fn get_files(app_id: u32) -> Result<Vec<LocalCloudFile>> {
    #[cfg(target_os = "windows")]
    {
        let client = LocalRemoteStorageClient::new(app_id)?;
        return client.list_files();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let install = detect_steam()?;
        let steam_id32 = current_steam_id32()?;
        let mut files: Vec<LocalCloudFile> =
            discover_local_cloud_saves(&install.path, steam_id32, app_id)?
                .into_iter()
                .map(|entry| {
                    if let Some(remote) = entry.remote {
                        LocalCloudFile {
                            filename: remote.filename,
                            size: remote.size,
                            timestamp: remote.timestamp,
                            exists: true,
                            persisted: remote.persisted.unwrap_or(0) != 0,
                            sync_platforms: remote
                                .platforms_to_download
                                .as_deref()
                                .and_then(|value| value.parse::<i32>().ok())
                                .unwrap_or(-1),
                            sha_file: remote.sha_file,
                            url: None,
                        }
                    } else {
                        LocalCloudFile {
                            filename: entry.filename,
                            size: entry.local_size,
                            timestamp: entry.local_timestamp,
                            exists: entry.local_size > 0 || entry.local_timestamp > 0,
                            persisted: false,
                            sync_platforms: -1,
                            sha_file: None,
                            url: None,
                        }
                    }
                })
                .collect();

        files.sort_by(|a, b| {
            b.timestamp
                .cmp(&a.timestamp)
                .then_with(|| a.filename.cmp(&b.filename))
        });
        Ok(files)
    }
}

pub fn get_quota(app_id: u32) -> Result<LocalCloudQuota> {
    #[cfg(target_os = "windows")]
    {
        let client = LocalRemoteStorageClient::new(app_id)?;
        return client.get_quota();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let used_bytes = get_files(app_id)?.iter().map(|file| file.size).sum();
        let total_bytes = app_quota_bytes(app_id)?.unwrap_or(0);
        Ok(LocalCloudQuota {
            total_bytes,
            used_bytes,
        })
    }
}

pub fn get_entries(app_id: u32) -> Result<Vec<LocalCloudEntry>> {
    let install = detect_steam()?;
    let steam_id32 = current_steam_id32()?;
    let remote_files = get_files(app_id)?;
    let local_entries = discover_local_cloud_saves(&install.path, steam_id32, app_id)?;

    let mut entries: Vec<LocalCloudEntry> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for remote in &remote_files {
        seen.insert(remote.filename.clone());
        let local = local_entries
            .iter()
            .find(|entry| entry.filename == remote.filename);
        let local_size = local.map(|entry| entry.local_size).unwrap_or(0);
        let local_timestamp = local.map(|entry| entry.local_timestamp).unwrap_or(0);

        entries.push(LocalCloudEntry {
            filename: remote.filename.clone(),
            remote_size: Some(remote.size),
            remote_timestamp: Some(remote.timestamp),
            local_size,
            local_timestamp,
            local_is_newer: local_timestamp > remote.timestamp,
            url: None,
        });
    }

    for local in &local_entries {
        if seen.contains(&local.filename) {
            continue;
        }
        entries.push(LocalCloudEntry {
            filename: local.filename.clone(),
            remote_size: None,
            remote_timestamp: None,
            local_size: local.local_size,
            local_timestamp: local.local_timestamp,
            local_is_newer: false,
            url: None,
        });
    }

    entries.sort_by(|a, b| {
        b.remote_timestamp
            .unwrap_or(b.local_timestamp)
            .cmp(&a.remote_timestamp.unwrap_or(a.local_timestamp))
            .then_with(|| a.filename.cmp(&b.filename))
    });
    Ok(entries)
}

pub fn read_file(app_id: u32, filename: &str) -> Result<Vec<u8>> {
    #[cfg(target_os = "windows")]
    {
        let client = LocalRemoteStorageClient::new(app_id)?;
        return client.file_read(filename);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_id, filename);
        Err(unavailable())
    }
}

pub fn write_file(app_id: u32, filename: &str, bytes: &[u8]) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        let client = LocalRemoteStorageClient::new(app_id)?;
        return client.file_write(filename, bytes);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_id, filename, bytes);
        Err(unavailable())
    }
}

pub fn delete_file(app_id: u32, filename: &str) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        let client = LocalRemoteStorageClient::new(app_id)?;
        return client.file_delete(filename);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app_id, filename);
        Err(unavailable())
    }
}

#[cfg(target_os = "windows")]
const STEAM_CLIENT_VERSION: &str = "SteamClient018";
#[cfg(target_os = "windows")]
const STEAM_UTILS_VERSION: &str = "SteamUtils007";
#[cfg(target_os = "windows")]
const REMOTE_STORAGE_VERSIONS: &[&str] = &[
    "STEAMREMOTESTORAGE_INTERFACE_VERSION016",
    "STEAMREMOTESTORAGE_INTERFACE_VERSION014",
    "STEAMREMOTESTORAGE_INTERFACE_VERSION012",
];

#[cfg(target_os = "windows")]
type CreateInterfaceFn = unsafe extern "C" fn(*const c_char, *mut i32) -> *mut c_void;

#[cfg(target_os = "windows")]
struct LocalRemoteStorageClient {
    module: HMODULE,
    steam_client: *mut c_void,
    steam_remote_storage: *mut c_void,
    _steam_utils: *mut c_void,
    pipe: i32,
    user: i32,
    steam_appid_path: Option<std::path::PathBuf>,
}

#[cfg(target_os = "windows")]
impl LocalRemoteStorageClient {
    fn new(app_id: u32) -> Result<Self> {
        let install = detect_steam()?;
        let steamclient_path = install.path.join("steamclient64.dll");
        if !steamclient_path.exists() {
            return Err(SteamError::NotFound(format!(
                "steamclient64.dll not found: {}",
                steamclient_path.display()
            )));
        }

        std::env::set_var("SteamAppId", app_id.to_string());
        let steam_appid_path = std::env::temp_dir().join(format!(
            "doona-steam-cloud-appid-{}-{}.txt",
            std::process::id(),
            app_id
        ));
        let _ = std::fs::write(&steam_appid_path, app_id.to_string());

        let steamclient_c = CString::new(steamclient_path.to_string_lossy().as_bytes())
            .map_err(|e| SteamError::General(format!("Invalid steamclient path: {}", e)))?;
        let module = unsafe {
            LoadLibraryExA(
                steamclient_c.as_ptr() as *const u8,
                ptr::null_mut(),
                LOAD_WITH_ALTERED_SEARCH_PATH,
            )
        };
        if module.is_null() {
            let code = unsafe { GetLastError() };
            return Err(SteamError::General(format!(
                "Failed to load steamclient64.dll (Win32 error {}) from {}",
                code,
                steamclient_path.display()
            )));
        }

        let create_interface = get_export::<CreateInterfaceFn>(module, b"CreateInterface\0")?;
        let steam_client = call_create_interface(create_interface, STEAM_CLIENT_VERSION)?;
        let pipe = unsafe { call_thiscall1_i32(steam_client, 0, ptr::null()) };
        if pipe == 0 {
            unsafe {
                FreeLibrary(module);
            }
            return Err(SteamError::General("Failed to create Steam pipe".into()));
        }

        let user = unsafe { call_thiscall2_i32(steam_client, 2, pipe) };
        if user == 0 {
            unsafe {
                FreeLibrary(module);
            }
            return Err(SteamError::General(
                "Failed to connect to global Steam user".into(),
            ));
        }

        let result = (|| {
            let steam_remote_storage = unsafe {
                call_get_interface_any(steam_client, 17, user, pipe, REMOTE_STORAGE_VERSIONS)?
            };
            let steam_utils =
                unsafe { call_get_utils(steam_client, 9, pipe, STEAM_UTILS_VERSION)? };
            let current_app_id = unsafe { call_thiscall0_u32(steam_utils, 9) };
            if app_id > 0 && current_app_id != app_id {
                return Err(SteamError::General(format!(
                    "Steam app context mismatch: requested app {} but local client reported {}",
                    app_id, current_app_id
                )));
            }

            let rs_vt = unsafe { *(steam_remote_storage as *mut *mut *mut c_void) };
            type SetCloudEnabledForAppFn = unsafe extern "system" fn(*mut c_void, bool);
            let set_cloud_enabled_for_app: SetCloudEnabledForAppFn =
                unsafe { std::mem::transmute(*rs_vt.add(23)) };
            unsafe { set_cloud_enabled_for_app(steam_remote_storage, true) };

            Ok(Self {
                module,
                steam_client,
                steam_remote_storage,
                _steam_utils: steam_utils,
                pipe,
                user,
                steam_appid_path: Some(steam_appid_path.clone()),
            })
        })();

        if result.is_err() {
            std::env::remove_var("SteamAppId");
            let _ = std::fs::remove_file(&steam_appid_path);
            unsafe {
                call_thiscall2_void(steam_client, 4, pipe, user);
                call_thiscall1_bool(steam_client, 1, pipe);
                FreeLibrary(module);
            }
        }

        result
    }

    fn list_files(&self) -> Result<Vec<LocalCloudFile>> {
        let vt = unsafe { *(self.steam_remote_storage as *mut *mut *mut c_void) };

        type GetFileCountFn = unsafe extern "system" fn(*mut c_void) -> i32;
        type GetFileNameAndSizeFn =
            unsafe extern "system" fn(*mut c_void, i32, *mut i32) -> *const c_char;
        type FileExistsFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> bool;
        type FilePersistedFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> bool;
        type GetFileTimestampFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> i64;
        type GetSyncPlatformsFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> i32;

        let get_file_count: GetFileCountFn = unsafe { std::mem::transmute(*vt.add(18)) };
        let get_file_name_and_size: GetFileNameAndSizeFn =
            unsafe { std::mem::transmute(*vt.add(19)) };
        let file_exists: FileExistsFn = unsafe { std::mem::transmute(*vt.add(13)) };
        let file_persisted: FilePersistedFn = unsafe { std::mem::transmute(*vt.add(14)) };
        let get_file_timestamp: GetFileTimestampFn = unsafe { std::mem::transmute(*vt.add(16)) };
        let get_sync_platforms: GetSyncPlatformsFn = unsafe { std::mem::transmute(*vt.add(17)) };

        let count = unsafe { get_file_count(self.steam_remote_storage) };
        if count < 0 {
            return Err(SteamError::General(
                "Failed to enumerate Steam cloud files".into(),
            ));
        }

        let mut files = Vec::new();
        for index in 0..count {
            let mut size = 0i32;
            let name_ptr =
                unsafe { get_file_name_and_size(self.steam_remote_storage, index, &mut size) };
            if name_ptr.is_null() {
                continue;
            }
            let filename = unsafe { std::ffi::CStr::from_ptr(name_ptr) }
                .to_string_lossy()
                .into_owned();
            let name = CString::new(filename.as_str())
                .map_err(|e| SteamError::General(format!("Invalid cloud filename: {}", e)))?;
            let exists = unsafe { file_exists(self.steam_remote_storage, name.as_ptr()) };
            let persisted = unsafe { file_persisted(self.steam_remote_storage, name.as_ptr()) };
            let timestamp = unsafe { get_file_timestamp(self.steam_remote_storage, name.as_ptr()) };
            let sync_platforms =
                unsafe { get_sync_platforms(self.steam_remote_storage, name.as_ptr()) };

            files.push(LocalCloudFile {
                filename,
                size: size.max(0) as u64,
                timestamp: timestamp.max(0) as u64,
                exists,
                persisted,
                sync_platforms,
                sha_file: None,
                url: None,
            });
        }

        files.sort_by(|a, b| {
            b.timestamp
                .cmp(&a.timestamp)
                .then_with(|| a.filename.cmp(&b.filename))
        });
        Ok(files)
    }

    fn get_quota(&self) -> Result<LocalCloudQuota> {
        let vt = unsafe { *(self.steam_remote_storage as *mut *mut *mut c_void) };
        type GetQuotaFn = unsafe extern "system" fn(*mut c_void, *mut u64, *mut u64) -> bool;
        let get_quota: GetQuotaFn = unsafe { std::mem::transmute(*vt.add(20)) };
        let mut total = 0u64;
        let mut available = 0u64;
        let ok = unsafe { get_quota(self.steam_remote_storage, &mut total, &mut available) };
        if !ok {
            return Err(SteamError::General(
                "Failed to query Steam cloud quota".into(),
            ));
        }
        Ok(LocalCloudQuota {
            total_bytes: total,
            used_bytes: total.saturating_sub(available),
        })
    }

    fn file_read(&self, filename: &str) -> Result<Vec<u8>> {
        let name = CString::new(filename)
            .map_err(|e| SteamError::General(format!("Invalid cloud filename: {}", e)))?;
        let vt = unsafe { *(self.steam_remote_storage as *mut *mut *mut c_void) };

        type FileExistsFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> bool;
        type GetFileSizeFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> i32;
        type FileReadFn =
            unsafe extern "system" fn(*mut c_void, *const c_char, *mut c_void, i32) -> i32;

        let file_exists: FileExistsFn = unsafe { std::mem::transmute(*vt.add(13)) };
        let get_file_size: GetFileSizeFn = unsafe { std::mem::transmute(*vt.add(15)) };
        let file_read: FileReadFn = unsafe { std::mem::transmute(*vt.add(1)) };

        let exists = unsafe { file_exists(self.steam_remote_storage, name.as_ptr()) };
        if !exists {
            return Err(SteamError::NotFound(format!(
                "Cloud file not found: {}",
                filename
            )));
        }

        let size = unsafe { get_file_size(self.steam_remote_storage, name.as_ptr()) };
        if size < 0 {
            return Err(SteamError::General(format!(
                "Failed to query cloud file size: {}",
                filename
            )));
        }
        if size == 0 {
            return Ok(Vec::new());
        }

        let mut buffer = vec![0u8; size as usize];
        let read = unsafe {
            file_read(
                self.steam_remote_storage,
                name.as_ptr(),
                buffer.as_mut_ptr() as *mut c_void,
                size,
            )
        };
        if read < 0 {
            return Err(SteamError::General(format!(
                "Failed to read cloud file: {}",
                filename
            )));
        }
        buffer.truncate(read as usize);
        Ok(buffer)
    }

    fn file_write(&self, filename: &str, bytes: &[u8]) -> Result<()> {
        let name = CString::new(filename)
            .map_err(|e| SteamError::General(format!("Invalid cloud filename: {}", e)))?;
        let vt = unsafe { *(self.steam_remote_storage as *mut *mut *mut c_void) };
        type FileWriteFn =
            unsafe extern "system" fn(*mut c_void, *const c_char, *const c_void, i32) -> bool;
        let file_write: FileWriteFn = unsafe { std::mem::transmute(*vt.add(0)) };
        let ok = unsafe {
            file_write(
                self.steam_remote_storage,
                name.as_ptr(),
                bytes.as_ptr() as *const c_void,
                bytes.len() as i32,
            )
        };
        if !ok {
            return Err(SteamError::General(format!(
                "Failed to write cloud file: {}",
                filename
            )));
        }
        Ok(())
    }

    fn file_delete(&self, filename: &str) -> Result<()> {
        let name = CString::new(filename)
            .map_err(|e| SteamError::General(format!("Invalid cloud filename: {}", e)))?;
        let vt = unsafe { *(self.steam_remote_storage as *mut *mut *mut c_void) };
        type FileDeleteFn = unsafe extern "system" fn(*mut c_void, *const c_char) -> bool;
        let file_delete: FileDeleteFn = unsafe { std::mem::transmute(*vt.add(6)) };
        let ok = unsafe { file_delete(self.steam_remote_storage, name.as_ptr()) };
        if !ok {
            return Err(SteamError::General(format!(
                "Failed to delete cloud file: {}",
                filename
            )));
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
impl Drop for LocalRemoteStorageClient {
    fn drop(&mut self) {
        std::env::remove_var("SteamAppId");
        if let Some(path) = &self.steam_appid_path {
            let _ = std::fs::remove_file(path);
        }
        unsafe {
            call_thiscall2_void(self.steam_client, 4, self.pipe, self.user);
            call_thiscall1_bool(self.steam_client, 1, self.pipe);
            FreeLibrary(self.module);
        }
    }
}

#[cfg(target_os = "windows")]
fn get_export<T>(module: HMODULE, symbol: &[u8]) -> Result<T> {
    let ptr = unsafe { GetProcAddress(module, symbol.as_ptr()) };
    let Some(ptr) = ptr else {
        return Err(SteamError::General(format!(
            "Missing steamclient export {}",
            String::from_utf8_lossy(&symbol[..symbol.len().saturating_sub(1)])
        )));
    };
    Ok(unsafe { std::mem::transmute_copy(&ptr) })
}

#[cfg(target_os = "windows")]
fn call_create_interface(create: CreateInterfaceFn, version: &str) -> Result<*mut c_void> {
    let version = CString::new(version)
        .map_err(|e| SteamError::General(format!("Invalid interface version: {}", e)))?;
    let mut code = 0i32;
    let ptr = unsafe { create(version.as_ptr(), &mut code) };
    if ptr.is_null() {
        return Err(SteamError::General(format!(
            "CreateInterface({}) failed with code {}",
            version.to_string_lossy(),
            code
        )));
    }
    Ok(ptr)
}

#[cfg(target_os = "windows")]
unsafe fn call_get_interface(
    steam_client: *mut c_void,
    slot: usize,
    user: i32,
    pipe: i32,
    version: &str,
) -> Result<*mut c_void> {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32, i32, *const c_char) -> *mut c_void;
    let version = CString::new(version)
        .map_err(|e| SteamError::General(format!("Invalid interface version: {}", e)))?;
    let vt = *(steam_client as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    let ptr = func(steam_client, user, pipe, version.as_ptr());
    if ptr.is_null() {
        return Err(SteamError::General(format!(
            "Failed to acquire {}",
            version.to_string_lossy()
        )));
    }
    Ok(ptr)
}

#[cfg(target_os = "windows")]
unsafe fn call_get_interface_any(
    steam_client: *mut c_void,
    slot: usize,
    user: i32,
    pipe: i32,
    versions: &[&str],
) -> Result<*mut c_void> {
    let mut last_error = None;
    for version in versions {
        match call_get_interface(steam_client, slot, user, pipe, version) {
            Ok(ptr) => return Ok(ptr),
            Err(error) => last_error = Some(error),
        }
    }
    Err(last_error.unwrap_or_else(|| {
        SteamError::General("Failed to acquire Steam remote storage interface".into())
    }))
}

#[cfg(target_os = "windows")]
unsafe fn call_get_utils(
    steam_client: *mut c_void,
    slot: usize,
    pipe: i32,
    version: &str,
) -> Result<*mut c_void> {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32, *const c_char) -> *mut c_void;
    let version = CString::new(version)
        .map_err(|e| SteamError::General(format!("Invalid interface version: {}", e)))?;
    let vt = *(steam_client as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    let ptr = func(steam_client, pipe, version.as_ptr());
    if ptr.is_null() {
        return Err(SteamError::General(format!(
            "Failed to acquire {}",
            version.to_string_lossy()
        )));
    }
    Ok(ptr)
}

#[cfg(target_os = "windows")]
unsafe fn call_thiscall0_u32(this: *mut c_void, slot: usize) -> u32 {
    type FnSig = unsafe extern "system" fn(*mut c_void) -> u32;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this)
}

#[cfg(target_os = "windows")]
unsafe fn call_thiscall1_i32(this: *mut c_void, slot: usize, arg1: *const c_void) -> i32 {
    type FnSig = unsafe extern "system" fn(*mut c_void, *const c_void) -> i32;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1)
}

#[cfg(target_os = "windows")]
unsafe fn call_thiscall2_i32(this: *mut c_void, slot: usize, arg1: i32) -> i32 {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32) -> i32;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1)
}

#[cfg(target_os = "windows")]
unsafe fn call_thiscall2_void(this: *mut c_void, slot: usize, arg1: i32, arg2: i32) {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32, i32);
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1, arg2)
}

#[cfg(target_os = "windows")]
unsafe fn call_thiscall1_bool(this: *mut c_void, slot: usize, arg1: i32) -> bool {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32) -> bool;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1)
}
