#![cfg(target_os = "windows")]

use crate::error::{Result, SteamError};
use crate::local::achievement_schema::LocalAchievementDef;
use crate::local::steam_path::detect_steam;
use std::ffi::{c_char, c_void, CString};
use std::mem::MaybeUninit;
use std::ptr;
use windows_sys::Win32::Foundation::{FreeLibrary, GetLastError, HMODULE};
use windows_sys::Win32::System::LibraryLoader::{
    GetProcAddress, LoadLibraryExA, LOAD_WITH_ALTERED_SEARCH_PATH,
};

const USER_STATS_RECEIVED_ID: i32 = 1101;
const USER_STATS_OK_RESULT: i32 = 1;
const STEAM_CLIENT_VERSION: &str = "SteamClient018";
const STEAM_USER_STATS_VERSION: &str = "STEAMUSERSTATS_INTERFACE_VERSION011";
const STEAM_UTILS_VERSION: &str = "SteamUtils007";
const STEAM_APPS_VERSION: &str = "STEAMAPPS_INTERFACE_VERSION001";

#[derive(Clone, Copy)]
#[repr(C, packed)]
struct CallbackMessage {
    user: i32,
    id: i32,
    param_pointer: *const c_void,
    param_size: i32,
}

#[derive(Clone, Copy)]
#[repr(C, packed)]
struct UserStatsReceived {
    game_id: u64,
    result: i32,
}

type CreateInterfaceFn = unsafe extern "C" fn(*const c_char, *mut i32) -> *mut c_void;
type SteamGetCallbackFn = unsafe extern "C" fn(i32, *mut CallbackMessage, *mut i32) -> bool;
type SteamFreeLastCallbackFn = unsafe extern "C" fn(i32) -> bool;

#[derive(Debug, Clone)]
pub struct LocalAchievementState {
    pub name: String,
    pub achieved: bool,
    pub unlock_time: u64,
}

pub fn read_live_achievement_state(
    defs: &[LocalAchievementDef],
    app_id: u32,
) -> Result<Vec<LocalAchievementState>> {
    let install = detect_steam()?;
    let steamclient_path = install.path.join("steamclient64.dll");
    if !steamclient_path.exists() {
        return Err(SteamError::NotFound(format!(
            "steamclient64.dll not found: {}",
            steamclient_path.display()
        )));
    }

    let mut client = LocalSteamClient::new(&steamclient_path, app_id)?;
    client.request_current_stats(app_id)?;

    defs.iter()
        .map(|def| {
            let (achieved, unlock_time) = client.get_achievement_and_unlock_time(&def.name)?;
            Ok(LocalAchievementState {
                name: def.name.clone(),
                achieved,
                unlock_time,
            })
        })
        .collect()
}

struct LocalSteamClient {
    module: HMODULE,
    steam_client: *mut c_void,
    steam_user_stats: *mut c_void,
    _steam_utils: *mut c_void,
    _steam_apps: *mut c_void,
    pipe: i32,
    user: i32,
    steam_get_callback: SteamGetCallbackFn,
    steam_free_last_callback: SteamFreeLastCallbackFn,
    steam_appid_path: Option<std::path::PathBuf>,
}

impl LocalSteamClient {
    fn new(path: &std::path::Path, app_id: u32) -> Result<Self> {
        std::env::set_var("SteamAppId", app_id.to_string());
        let steam_appid_path = std::env::temp_dir().join(format!(
            "doona-steam-appid-{}-{}.txt",
            std::process::id(),
            app_id
        ));
        let _ = std::fs::write(&steam_appid_path, app_id.to_string());

        let steamclient_c = CString::new(path.to_string_lossy().as_bytes())
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
                path.display()
            )));
        }

        let create_interface = get_export::<CreateInterfaceFn>(module, b"CreateInterface\0")?;
        let steam_get_callback = get_export::<SteamGetCallbackFn>(module, b"Steam_BGetCallback\0")?;
        let steam_free_last_callback =
            get_export::<SteamFreeLastCallbackFn>(module, b"Steam_FreeLastCallback\0")?;

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
            let steam_user_stats = unsafe {
                call_get_interface(steam_client, 13, user, pipe, STEAM_USER_STATS_VERSION)?
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
            let steam_apps =
                unsafe { call_get_interface(steam_client, 15, user, pipe, STEAM_APPS_VERSION)? };

            Ok(Self {
                module,
                steam_client,
                steam_user_stats,
                _steam_utils: steam_utils,
                _steam_apps: steam_apps,
                pipe,
                user,
                steam_get_callback,
                steam_free_last_callback,
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

    fn request_current_stats(&mut self, app_id: u32) -> Result<()> {
        let ok = unsafe { call_thiscall0_bool(self.steam_user_stats, 0) };
        if !ok {
            return Err(SteamError::General(
                "Steam RequestCurrentStats failed".into(),
            ));
        }

        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        while std::time::Instant::now() < deadline {
            let mut call = 0i32;
            loop {
                let mut raw_message = MaybeUninit::<CallbackMessage>::uninit();
                let has_callback = unsafe {
                    (self.steam_get_callback)(self.pipe, raw_message.as_mut_ptr(), &mut call)
                };
                if !has_callback {
                    break;
                }

                let message = unsafe { raw_message.assume_init() };
                let callback_id = message.id;
                let param_pointer = message.param_pointer;
                if callback_id == USER_STATS_RECEIVED_ID && !param_pointer.is_null() {
                    let stats =
                        unsafe { ptr::read_unaligned(param_pointer as *const UserStatsReceived) };
                    unsafe {
                        (self.steam_free_last_callback)(self.pipe);
                    }
                    let game_id = stats.game_id as u32;
                    let result = stats.result;
                    if game_id != app_id {
                        continue;
                    }
                    if result == USER_STATS_OK_RESULT {
                        return Ok(());
                    }
                    return Err(SteamError::General(format!(
                        "Steam user stats request failed with result {}",
                        result
                    )));
                }
                unsafe {
                    (self.steam_free_last_callback)(self.pipe);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        Err(SteamError::General(
            "Timed out waiting for Steam user stats".into(),
        ))
    }

    fn get_achievement_and_unlock_time(&self, name: &str) -> Result<(bool, u64)> {
        let c_name = CString::new(name)
            .map_err(|e| SteamError::General(format!("Invalid achievement name: {}", e)))?;
        let mut achieved = 0u8;
        let mut unlock_time = 0u64;
        let ok = unsafe {
            call_thiscall3_bool_ptr_bool_u64(
                self.steam_user_stats,
                9,
                c_name.as_ptr(),
                &mut achieved,
                &mut unlock_time,
            )
        };
        if !ok {
            return Ok((false, 0));
        }
        Ok((achieved != 0, unlock_time))
    }
}

impl Drop for LocalSteamClient {
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

unsafe fn call_get_interface(
    steam_client: *mut c_void,
    slot: usize,
    user: i32,
    pipe: i32,
    version: &str,
) -> Result<*mut c_void> {
    let version = CString::new(version)
        .map_err(|e| SteamError::General(format!("Invalid interface version: {}", e)))?;
    type FnSig = unsafe extern "system" fn(*mut c_void, i32, i32, *const c_char) -> *mut c_void;
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

unsafe fn call_thiscall0_bool(this: *mut c_void, slot: usize) -> bool {
    type FnSig = unsafe extern "system" fn(*mut c_void) -> bool;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this)
}

unsafe fn call_thiscall0_u32(this: *mut c_void, slot: usize) -> u32 {
    type FnSig = unsafe extern "system" fn(*mut c_void) -> u32;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this)
}

unsafe fn call_thiscall1_i32(this: *mut c_void, slot: usize, arg1: *const c_void) -> i32 {
    type FnSig = unsafe extern "system" fn(*mut c_void, *const c_void) -> i32;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1)
}

unsafe fn call_thiscall2_i32(this: *mut c_void, slot: usize, arg1: i32) -> i32 {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32) -> i32;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1)
}

unsafe fn call_thiscall2_void(this: *mut c_void, slot: usize, arg1: i32, arg2: i32) {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32, i32);
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1, arg2)
}

unsafe fn call_thiscall1_bool(this: *mut c_void, slot: usize, arg1: i32) -> bool {
    type FnSig = unsafe extern "system" fn(*mut c_void, i32) -> bool;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1)
}

unsafe fn call_thiscall3_bool_ptr_bool_u64(
    this: *mut c_void,
    slot: usize,
    arg1: *const c_char,
    arg2: *mut u8,
    arg3: *mut u64,
) -> bool {
    type FnSig = unsafe extern "system" fn(*mut c_void, *const c_char, *mut u8, *mut u64) -> bool;
    let vt = *(this as *mut *mut *mut c_void);
    let func: FnSig = std::mem::transmute(*vt.add(slot));
    func(this, arg1, arg2, arg3)
}
