use super::steam_path::detect_steam;
use super::switcher::{self, SteamUser};
use crate::error::{Result, SteamError};
use std::path::PathBuf;
use std::process::{Command, Stdio};

pub const PERSONA_OFFLINE: i32 = 0;
pub const PERSONA_ONLINE: i32 = 1;
pub const PERSONA_BUSY: i32 = 2;
pub const PERSONA_AWAY: i32 = 3;
pub const PERSONA_SNOOZE: i32 = 4;
pub const PERSONA_LOOKING_TO_TRADE: i32 = 5;
pub const PERSONA_LOOKING_TO_PLAY: i32 = 6;
pub const PERSONA_INVISIBLE: i32 = 7;

pub fn steam_id64_to_32(steam_id64: u64) -> u32 {
    (steam_id64 & 0xFFFF_FFFF) as u32
}

pub fn steam_id64_to_steam_id32_string(steam_id64: u64) -> String {
    steam_id64_to_32(steam_id64).to_string()
}

pub fn steam_id64_to_steam_id3(steam_id64: u64) -> String {
    format!("[U:1:{}]", steam_id64_to_32(steam_id64))
}

pub fn steam_id64_to_steam_id(steam_id64: u64) -> String {
    let steam_id32 = steam_id64_to_32(steam_id64) as u64;
    let oddity = steam_id32 % 2;
    let account_number = steam_id32 / 2;
    format!("STEAM_0:{}:{}", oddity, account_number)
}

pub fn steam_community_profile_url(steam_id64: u64) -> String {
    format!("https://steamcommunity.com/profiles/{}", steam_id64)
}

pub fn steamrep_url(steam_id64: u64) -> String {
    format!("https://steamrep.com/search?q={}", steam_id64)
}

pub fn steamrep_cn_url(steam_id64: u64) -> String {
    format!("https://steamrepcn.com/profiles/{}", steam_id64)
}

pub fn steamdb_calculator_url(steam_id64: u64) -> String {
    format!("https://steamdb.info/calculator/?player={}", steam_id64)
}

pub fn steamgifts_url(steam_id64: u64) -> String {
    format!("https://www.steamgifts.com/go/user/{}", steam_id64)
}

pub fn steamtrades_url(steam_id64: u64) -> String {
    format!("https://www.steamtrades.com/user/{}", steam_id64)
}

pub fn achievement_stats_url(steam_id64: u64) -> String {
    format!(
        "https://www.achievementstats.com/index.php?action=profile&playerId={}",
        steam_id64
    )
}

pub fn backpack_tf_url(steam_id64: u64) -> String {
    format!("https://backpack.tf/profiles/{}", steam_id64)
}

pub fn find_user(steam_id64: u64) -> Result<SteamUser> {
    switcher::read_login_users()?
        .into_iter()
        .find(|user| user.steam_id64 == steam_id64)
        .ok_or_else(|| SteamError::NotFound(format!("Steam user {} not found", steam_id64)))
}

pub fn userdata_path(steam_id64: u64) -> Result<PathBuf> {
    let install = detect_steam()?;
    Ok(install
        .userdata
        .join(steam_id64_to_steam_id32_string(steam_id64)))
}

pub fn set_persona_state_for_user(steam_id64: u64, state: i32) -> Result<()> {
    switcher::set_persona_state(steam_id64_to_32(steam_id64), state as u32)
}

pub fn remove_local_user(steam_id64: u64, delete_userdata: bool) -> Result<()> {
    super::steam_service::delete_local_user_data(steam_id64, delete_userdata)
}
