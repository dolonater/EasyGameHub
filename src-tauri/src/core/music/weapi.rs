use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use aes::Aes128;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use cbc::Encryptor;
use cipher::{block_padding::Pkcs7, BlockEncryptMut, KeyIvInit};
use image::{codecs::png::PngEncoder, ColorType, ImageEncoder, Luma};
use num_bigint::BigUint;
use qrcode::QrCode;
use rand::{rngs::OsRng, RngCore};
use reqwest::header::{CONTENT_TYPE, COOKIE, REFERER, SET_COOKIE, USER_AGENT};
use serde_json::Value;

use super::cookie as music_cookie;

const IV: &[u8; 16] = b"0102030405060708";
const PRESET_KEY: &[u8; 16] = b"0CoJUm6Qyw8W8jud";
const SECRET_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const NETEASE_RSA_EXPONENT: u32 = 65_537;
const NETEASE_RSA_MODULUS_HEX: &str = "e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
const REFERER_VALUE: &str = "https://music.163.com/";
const USER_AGENT_VALUE: &str = "Mozilla/5.0 EasyGameHub/0.1";

type Aes128CbcEnc = Encryptor<Aes128>;

pub struct WeapiResponse {
    pub status: reqwest::StatusCode,
    pub json: Value,
    pub cookie_header: String,
}

pub fn encode_params(data: &Value) -> Result<HashMap<String, String>, anyhow::Error> {
    let secret = random_secret();
    encode_params_with_secret(data, &secret)
}

pub fn encode_params_with_secret(
    data: &Value,
    secret: &[u8; 16],
) -> Result<HashMap<String, String>, anyhow::Error> {
    let text = serde_json::to_vec(data)?;
    let first = aes_cbc_encrypt(&text, PRESET_KEY)?;
    let first_b64 = BASE64.encode(first);
    let second = aes_cbc_encrypt(first_b64.as_bytes(), secret)?;
    let enc_sec_key = rsa_encrypt_secret(secret)?;

    Ok(HashMap::from([
        ("params".to_string(), BASE64.encode(second)),
        ("encSecKey".to_string(), enc_sec_key),
    ]))
}

pub fn generate_s_device_id() -> String {
    random_hex(52)
}

pub fn generate_chain_id_for_device(s_device_id: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("v1_{}_web_login_{timestamp}", s_device_id)
}

pub fn qr_data_url(qr_url: &str) -> Result<String, anyhow::Error> {
    let code = QrCode::new(qr_url.as_bytes())?;
    let image = code.render::<Luma<u8>>().min_dimensions(256, 256).build();
    let mut png = Vec::new();
    let encoder = PngEncoder::new(&mut png);
    encoder.write_image(
        image.as_raw(),
        image.width(),
        image.height(),
        ColorType::L8.into(),
    )?;
    Ok(format!("data:image/png;base64,{}", BASE64.encode(png)))
}

pub async fn post_weapi(
    url: &str,
    data: Value,
    cookie: Option<&str>,
) -> Result<WeapiResponse, anyhow::Error> {
    let form = encode_params(&data)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(USER_AGENT_VALUE)
        .build()?;
    let mut request = client
        .post(url)
        .header(USER_AGENT, USER_AGENT_VALUE)
        .header(REFERER, REFERER_VALUE)
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&form);
    if let Some(cookie) = cookie.filter(|value| !value.trim().is_empty()) {
        request = request.header(COOKIE, cookie);
    }

    let response = request.send().await?;
    let status = response.status();
    let cookie_header = collect_set_cookie(response.headers());
    response.error_for_status_ref()?;
    let json = response.json::<Value>().await?;
    Ok(WeapiResponse {
        status,
        json,
        cookie_header,
    })
}

fn aes_cbc_encrypt(data: &[u8], key: &[u8; 16]) -> Result<Vec<u8>, anyhow::Error> {
    let mut buffer = Vec::with_capacity(data.len() + 16);
    buffer.extend_from_slice(data);
    let message_len = buffer.len();
    buffer.resize(message_len + 16, 0);
    let encrypted = Aes128CbcEnc::new_from_slices(key, IV)
        .map_err(|error| anyhow::Error::msg(error.to_string()))?
        .encrypt_padded_mut::<Pkcs7>(&mut buffer, message_len)
        .map_err(|error| anyhow::Error::msg(error.to_string()))?;
    Ok(encrypted.to_vec())
}

fn rsa_encrypt_secret(secret: &[u8; 16]) -> Result<String, anyhow::Error> {
    let modulus = BigUint::parse_bytes(NETEASE_RSA_MODULUS_HEX.as_bytes(), 16)
        .ok_or_else(|| anyhow::Error::msg("Invalid NetEase RSA modulus"))?;
    let exponent = BigUint::from(NETEASE_RSA_EXPONENT);
    let mut padded = vec![0_u8; 112];
    padded.extend(secret.iter().rev());
    let encrypted = BigUint::from_bytes_be(&padded).modpow(&exponent, &modulus);
    Ok(format!("{:0>256}", encrypted.to_str_radix(16)))
}

fn random_secret() -> [u8; 16] {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    for byte in &mut bytes {
        *byte = SECRET_CHARS[*byte as usize % SECRET_CHARS.len()];
    }
    bytes
}

fn random_hex(len: usize) -> String {
    const HEX: &[u8] = b"0123456789ABCDEF";
    let mut bytes = vec![0_u8; len];
    OsRng.fill_bytes(&mut bytes);
    bytes
        .into_iter()
        .map(|byte| HEX[byte as usize % HEX.len()] as char)
        .collect()
}

fn collect_set_cookie(headers: &reqwest::header::HeaderMap) -> String {
    let raw = headers
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .filter_map(|value| value.split(';').next())
        .collect::<Vec<_>>()
        .join("; ");
    music_cookie::normalize_cookie_header(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn encodes_weapi_params_with_fixed_secret() {
        let secret = *b"1234567890abcdef";
        let encoded = encode_params_with_secret(&json!({"type": 1}), &secret).unwrap();
        assert!(encoded.get("params").is_some_and(|value| !value.is_empty()));
        assert_eq!(encoded.get("encSecKey").map(String::len), Some(256));
        assert_eq!(
            encoded.get("encSecKey").map(String::as_str),
            Some("bc05a756cb87b1a2674efda9e90a27d641dcbbe2e6b7be3b61193e47315c298183d409578ac80502bd441d82bf1611d6d9238bcaf64794d096417b726373fdd8cf4a9e9d31d198d6d785ffa3d0a2e8c621b4d6c019fabe0ca6f3a815d9f2a4875a0bcab968f331f394566e1162603ed1dd002aa89b47fd8dcbc77d2c6976efed"),
        );
    }

    #[test]
    fn generates_login_chain_id() {
        let s_device_id = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123";
        let chain_id = generate_chain_id_for_device(s_device_id);
        assert!(chain_id.starts_with("v1_"));
        assert!(chain_id.contains(s_device_id));
        assert!(chain_id.contains("_web_login_"));
    }

    #[test]
    fn creates_qr_png_data_url() {
        let data_url = qr_data_url("http://music.163.com/login?codekey=test").unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));
    }
}
