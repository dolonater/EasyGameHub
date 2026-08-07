use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use reqwest::header::{CONTENT_TYPE, REFERER, USER_AGENT};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

use super::{
    cookie,
    models::{CaptchaSentResult, LoginInfo, LoginQrCheckResult, LoginQrKeyResult},
    netease, weapi,
};

const LOGIN_LABEL: &str = "netease-login";
const LOGIN_URL: &str = "https://music.163.com/#/login";
const QR_UNIKEY_URL: &str = "https://music.163.com/weapi/login/qrcode/unikey";
const QR_CHECK_URL: &str = "https://music.163.com/weapi/login/qrcode/client/login";
const SMS_CAPTCHA_URL: &str = "https://music.163.com/api/sms/captcha/sent";
const CELLPHONE_LOGIN_URL: &str = "https://music.163.com/weapi/login/cellphone";
const REFERER_VALUE: &str = "https://music.163.com/";
const USER_AGENT_VALUE: &str = "Mozilla/5.0 EasyGameHub/0.1";
const QR_SESSION_TTL: Duration = Duration::from_secs(5 * 60);

#[derive(Clone)]
struct QrLoginSession {
    cookie_header: String,
    created_at: Instant,
}

static QR_LOGIN_SESSIONS: OnceLock<Mutex<HashMap<String, QrLoginSession>>> = OnceLock::new();

pub async fn open_login_window(app: AppHandle) -> Result<(), anyhow::Error> {
    let login_url = Url::parse(LOGIN_URL)?;
    let window = if let Some(window) = app.get_webview_window(LOGIN_LABEL) {
        window.navigate(login_url.clone())?;
        window.show()?;
        window.set_focus()?;
        window
    } else {
        WebviewWindowBuilder::new(&app, LOGIN_LABEL, WebviewUrl::External(login_url.clone()))
            .title("NetEase Cloud Music Login")
            .inner_size(480.0, 720.0)
            .resizable(true)
            .build()?
    };

    let app_for_poll = app.clone();
    tauri::async_runtime::spawn(async move {
        let started = Instant::now();
        let cookie_url = Url::parse("https://music.163.com/").ok();
        while started.elapsed() < Duration::from_secs(5 * 60) {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let Some(url) = cookie_url.clone() else {
                continue;
            };
            let cookies = match window.cookies_for_url(url) {
                Ok(cookies) => cookies,
                Err(error) => {
                    let _ = app_for_poll.emit("music:login-failed", error.to_string());
                    continue;
                }
            };
            let cookie_header = cookies
                .into_iter()
                .filter(|cookie| cookie.domain().map(is_netease_domain).unwrap_or(true))
                .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
                .collect::<Vec<_>>()
                .join("; ");
            let normalized = cookie::normalize_cookie_header(&cookie_header);
            if !cookie::netease_cookie_has_login(&normalized) {
                continue;
            }

            if let Err(error) = cookie::save_cookie(&app_for_poll, "netease", &normalized) {
                let _ = app_for_poll.emit("music:login-failed", error.to_string());
                continue;
            }
            match netease::login_status(&normalized).await {
                Ok(info) if info.logged_in => {
                    let _ = app_for_poll.emit("music:login-success", &info);
                    let _ = window.destroy();
                    return;
                }
                Ok(_) => {
                    let _ = app_for_poll.emit("music:login-failed", "Cookie invalid");
                }
                Err(error) => {
                    let _ = app_for_poll.emit("music:login-failed", error.to_string());
                }
            }
        }
    });

    Ok(())
}

fn is_netease_domain(domain: &str) -> bool {
    let domain = domain.trim_start_matches('.').to_ascii_lowercase();
    domain == "music.163.com"
        || domain.ends_with(".music.163.com")
        || domain == "netease.com"
        || domain.ends_with(".netease.com")
        || domain == "163.com"
        || domain.ends_with(".163.com")
}

pub async fn create_qr_key() -> Result<LoginQrKeyResult, anyhow::Error> {
    let s_device_id = weapi::generate_s_device_id();
    let strategy_cookie = login_strategy_cookie(&s_device_id);
    let response = weapi::post_weapi(
        QR_UNIKEY_URL,
        json!({
            "type": 1,
            "noCheckToken": true,
        }),
        Some(&strategy_cookie),
    )
    .await?;
    let _status = response.status;
    let unikey = value_to_string(response.json.get("unikey"))
        .or_else(|| value_to_string(response.json.pointer("/data/unikey")))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow::Error::msg("NetEase QR login key was not returned"))?;
    let qr_url = format!(
        "http://music.163.com/login?codekey={}&chainId={}",
        urlencoding::encode(&unikey),
        urlencoding::encode(&weapi::generate_chain_id_for_device(&s_device_id))
    );
    let qr_image = weapi::qr_data_url(&qr_url)?;
    remember_qr_session(&unikey, strategy_cookie);

    Ok(LoginQrKeyResult {
        unikey,
        qr_url,
        qr_image,
    })
}

pub async fn check_qr_login(
    app: &AppHandle,
    key: &str,
) -> Result<LoginQrCheckResult, anyhow::Error> {
    let key = key.trim();
    if key.is_empty() {
        return Err(anyhow::Error::msg("QR login key is empty"));
    }
    let strategy_cookie = qr_session_cookie(key);

    let response = weapi::post_weapi(
        QR_CHECK_URL,
        json!({
            "type": 1,
            "noCheckToken": true,
            "key": key,
        }),
        Some(&strategy_cookie),
    )
    .await?;
    let _status = response.status;
    let code = as_u32(response.json.get("code")).unwrap_or(0);
    let message = value_to_string(
        response
            .json
            .get("message")
            .or_else(|| response.json.get("msg")),
    )
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| qr_status_message(code).to_string());

    if code == 800 {
        forget_qr_session(key);
    }
    if code != 803 {
        return Ok(LoginQrCheckResult {
            code,
            message,
            logged_in: false,
            login_info: None,
        });
    }

    let body_cookie = value_to_string(response.json.get("cookie")).unwrap_or_default();
    let response_cookie = merge_cookie_headers(&response.cookie_header, &body_cookie);
    let cookie_header = merge_cookie_headers(&strategy_cookie, &response_cookie);
    match finish_login(app, &cookie_header).await {
        Ok(info) => {
            forget_qr_session(key);
            Ok(LoginQrCheckResult {
                code,
                message,
                logged_in: true,
                login_info: Some(info),
            })
        }
        Err(error) => {
            let _ = app.emit("music:login-failed", error.to_string());
            Err(error)
        }
    }
}

pub async fn send_captcha(
    phone: &str,
    countrycode: Option<&str>,
) -> Result<CaptchaSentResult, anyhow::Error> {
    let phone = phone.trim();
    if phone.is_empty() {
        return Err(anyhow::Error::msg("手机号不能为空"));
    }
    let ctcode = countrycode
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("86");
    let form = [
        ("ctcode", ctcode.to_string()),
        ("cellphone", phone.to_string()),
        ("secrete", "music_middleuser_pclogin".to_string()),
    ];
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(USER_AGENT_VALUE)
        .build()?
        .post(SMS_CAPTCHA_URL)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(REFERER, REFERER_VALUE)
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&form)
        .send()
        .await?
        .error_for_status()?;
    let data = response.json::<Value>().await?;
    let code = as_u32(data.get("code")).unwrap_or(0);
    let message = value_to_string(data.get("message").or_else(|| data.get("msg")))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| captcha_status_message(code).to_string());

    Ok(CaptchaSentResult { code, message })
}

pub async fn login_cellphone(
    app: &AppHandle,
    phone: &str,
    countrycode: Option<&str>,
    captcha: &str,
) -> Result<LoginInfo, anyhow::Error> {
    let phone = phone.trim();
    let captcha = captcha.trim();
    if phone.is_empty() {
        return Err(anyhow::Error::msg("手机号不能为空"));
    }
    if captcha.is_empty() {
        return Err(anyhow::Error::msg("验证码不能为空"));
    }
    let countrycode = countrycode
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("86");
    let response = weapi::post_weapi(
        CELLPHONE_LOGIN_URL,
        json!({
            "phone": phone,
            "countrycode": countrycode,
            "captcha": captcha,
            "rememberLogin": "true",
            "type": "1",
            "https": "true",
            "remember": "true",
            "csrf_token": "",
        }),
        None,
    )
    .await?;
    let _status = response.status;
    let body_cookie = value_to_string(response.json.get("cookie")).unwrap_or_default();
    let response_cookie = merge_cookie_headers(&response.cookie_header, &body_cookie);
    let strategy_cookie = login_strategy_cookie(&weapi::generate_s_device_id());
    let cookie_header = merge_cookie_headers(&strategy_cookie, &response_cookie);
    match finish_login(app, &cookie_header).await {
        Ok(info) => Ok(info),
        Err(error) => {
            let _ = app.emit("music:login-failed", error.to_string());
            Err(error)
        }
    }
}

async fn finish_login(app: &AppHandle, cookie_header: &str) -> Result<LoginInfo, anyhow::Error> {
    let normalized = cookie::normalize_cookie_header(cookie_header);
    if !cookie::netease_cookie_has_login(&normalized) {
        return Err(anyhow::Error::msg("NetEase login cookie was not returned"));
    }
    cookie::save_cookie(app, "netease", &normalized)?;
    let info = netease::login_status(&normalized).await?;
    if !info.logged_in {
        return Err(anyhow::Error::msg("NetEase login cookie is invalid"));
    }
    let _ = app.emit("music:login-success", &info);
    Ok(info)
}

fn captcha_status_message(code: u32) -> &'static str {
    match code {
        200 => "验证码已发送",
        400 => "验证码发送失败",
        501 => "请求太频繁，请稍后再试",
        _ => "验证码发送状态未知",
    }
}

fn qr_status_message(code: u32) -> &'static str {
    match code {
        800 => "二维码已过期",
        801 => "等待扫码",
        802 => "已扫码，请在手机上确认",
        803 => "授权成功",
        _ => "二维码登录状态未知",
    }
}

fn merge_cookie_headers(primary: &str, secondary: &str) -> String {
    cookie::normalize_cookie_header(
        &[primary, secondary]
            .into_iter()
            .filter(|value| !value.trim().is_empty())
            .collect::<Vec<_>>()
            .join("; "),
    )
}

fn login_strategy_cookie(s_device_id: &str) -> String {
    cookie::normalize_cookie_header(&format!(
        "sDeviceId={}; os=pc; appver=8.9.70; __remember_me=true; NMTID={}",
        s_device_id,
        weapi::generate_s_device_id()
    ))
}

fn qr_sessions() -> &'static Mutex<HashMap<String, QrLoginSession>> {
    QR_LOGIN_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn remember_qr_session(key: &str, cookie_header: String) {
    if let Ok(mut sessions) = qr_sessions().lock() {
        prune_qr_sessions(&mut sessions);
        sessions.insert(
            key.to_string(),
            QrLoginSession {
                cookie_header,
                created_at: Instant::now(),
            },
        );
    }
}

fn qr_session_cookie(key: &str) -> String {
    if let Ok(mut sessions) = qr_sessions().lock() {
        prune_qr_sessions(&mut sessions);
        if let Some(session) = sessions.get(key) {
            return session.cookie_header.clone();
        }
    }
    login_strategy_cookie(&weapi::generate_s_device_id())
}

fn forget_qr_session(key: &str) {
    if let Ok(mut sessions) = qr_sessions().lock() {
        sessions.remove(key);
    }
}

fn prune_qr_sessions(sessions: &mut HashMap<String, QrLoginSession>) {
    let now = Instant::now();
    sessions.retain(|_, session| now.duration_since(session.created_at) <= QR_SESSION_TTL);
}

fn value_to_string(value: Option<&Value>) -> Option<String> {
    value.and_then(|value| match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    })
}

fn as_u32(value: Option<&Value>) -> Option<u32> {
    value.and_then(|value| value.as_u64().map(|number| number as u32))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_strategy_cookie_uses_s_device_id() {
        let s_device_id = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123";
        let cookie = login_strategy_cookie(s_device_id);
        assert!(cookie.contains("sDeviceId=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123"));
        assert!(cookie.contains("os=pc"));
        assert!(cookie.contains("NMTID="));
    }

    #[test]
    fn qr_session_cookie_reuses_created_strategy_cookie() {
        let key = "test-qr-session-key";
        let cookie = login_strategy_cookie("ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCD");
        remember_qr_session(key, cookie.clone());
        assert_eq!(qr_session_cookie(key), cookie);
        forget_qr_session(key);
    }

    #[test]
    fn merge_cookie_headers_keeps_login_and_strategy_cookies() {
        let merged = merge_cookie_headers(
            "sDeviceId=device; os=pc; appver=8.9.70; __remember_me=true; NMTID=nmtid",
            "MUSIC_U=music; __csrf=csrf",
        );
        assert!(merged.contains("MUSIC_U=music"));
        assert!(merged.contains("__csrf=csrf"));
        assert!(merged.contains("sDeviceId=device"));
        assert!(merged.contains("os=pc"));
        assert!(merged.contains("appver=8.9.70"));
        assert!(merged.contains("__remember_me=true"));
        assert!(merged.contains("NMTID=nmtid"));
    }
}
