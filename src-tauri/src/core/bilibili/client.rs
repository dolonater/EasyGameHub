use std::path::Path;

use bpi_rs::{BpiClient, BpiError};

use super::account::{cookie_to_account, load_cookie};
use super::models::BiliLoginInfo;

const WILIWILI_USER_AGENT: &str = "wiliwili";
const WILIWILI_REFERER: &str = "https://www.bilibili.com/client";
const BILIBILI_ORIGIN: &str = "https://www.bilibili.com";

pub fn anonymous_client() -> Result<BpiClient, BpiError> {
    BpiClient::builder()
        .user_agent(WILIWILI_USER_AGENT)
        .referer(WILIWILI_REFERER)
        .origin(BILIBILI_ORIGIN)
        .build()
}

pub fn client_from_cookie(cookie: impl Into<String>) -> Result<BpiClient, BpiError> {
    BpiClient::builder()
        .user_agent(WILIWILI_USER_AGENT)
        .referer(WILIWILI_REFERER)
        .origin(BILIBILI_ORIGIN)
        .cookie(cookie)
        .build()
}

pub fn account_client(tool_dir: &Path) -> Result<BpiClient, BpiError> {
    let cookie = load_cookie(tool_dir)?.ok_or_else(BpiError::auth_required)?;
    cookie_to_account(&cookie).ok_or_else(|| BpiError::auth("invalid login cookie"))?;
    client_from_cookie(cookie)
}

pub fn optional_account_client(tool_dir: &Path) -> Result<BpiClient, BpiError> {
    match load_cookie(tool_dir)? {
        Some(cookie) => client_from_cookie(cookie),
        None => anonymous_client(),
    }
}

pub async fn login_status(tool_dir: &Path) -> Result<BiliLoginInfo, BpiError> {
    let Some(cookie) = load_cookie(tool_dir)? else {
        return Ok(BiliLoginInfo::default());
    };
    let client = client_from_cookie(cookie)?;

    match client.login().nav().await {
        Ok(nav) if nav.is_login => Ok(BiliLoginInfo {
            provider: "bilibili".to_string(),
            logged_in: true,
            user_id: nav.mid.map(|mid| mid.get().to_string()).unwrap_or_default(),
            nickname: nav.uname.unwrap_or_default(),
            avatar: nav.face.unwrap_or_default(),
            login_expired: false,
            message: String::new(),
        }),
        Ok(_) => Ok(BiliLoginInfo::default()),
        Err(error) if error.requires_login() => Ok(BiliLoginInfo {
            login_expired: true,
            message: "Bilibili 登录已过期，请重新登录".to_string(),
            ..BiliLoginInfo::default()
        }),
        Err(error) => Err(error),
    }
}
