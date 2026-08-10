//! Steam chat history via the Web API service method
//! (`IFriendMessagesService/GetRecentMessages`).
//!
//! Real-time chat (friends, presence, messages) goes through the CM client
//! (`crate::cm`); this module only covers the history REST call, which uses the
//! `input_protobuf_encoded` service-method pattern with the session's access
//! token.

use crate::client::SteamHttpClient;
use crate::cm::proto_wire::{self, Writer};
use crate::error::{Result, SteamError};
use base64::Engine;
use serde::Deserialize;
use std::path::Path;

const API_BASE: &str = "https://api.steampowered.com";

/// Convert a Steam account id (low 32 bits) to a full SteamID64.
pub fn steamid64_from_account_id(account_id: u64) -> u64 {
    account_id + 0x0110_0001_0000_0000
}

/// One message in a chat history (both directions).
#[derive(Debug, Clone)]
pub struct HistoryMessage {
    /// Full sender SteamID64 (converted from the accountid Steam returns).
    pub sender_steamid: u64,
    pub timestamp: u32,
    pub body: String,
    pub ordinal: u32,
}

/// Result of a `GetRecentMessages` call.
#[derive(Debug, Clone, Default)]
pub struct RecentMessages {
    pub messages: Vec<HistoryMessage>,
    pub more_available: bool,
}

/// Fetch chat history exchanged with a friend.
///
/// `older_than` (`(rtime32_start_time, start_ordinal)`) pages **backward**: when
/// set, Steam returns the `count` messages ending just before that boundary
/// (used to load older history) instead of the most recent `count`. `None`
/// keeps the current "most recent" behavior.
///
/// GET `IFriendMessagesService/GetRecentMessages/v1` with the request encoded
/// as `input_protobuf_encoded`. Requires a valid session `access_token`.
pub fn get_recent_messages(
    client: &SteamHttpClient,
    access_token: &str,
    account_steamid: u64,
    partner: u64,
    count: u32,
    older_than: Option<(u32, u32)>,
) -> Result<RecentMessages> {
    let request_bytes = build_recent_messages_request(account_steamid, partner, count, older_than);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&request_bytes);

    let url = format!(
        "{}/IFriendMessagesService/GetRecentMessages/v1/?input_protobuf_encoded={}&access_token={}",
        API_BASE,
        percent_encode(&encoded),
        percent_encode(access_token)
    );
    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(status_error(response.status()));
    }
    let body = response.into_vec()?;
    let parsed = parse_recent_messages(&body)?;
    // Diagnostic: if the response DID contain message entries (field 1 bytes)
    // but none parsed into a message, surface the field structure instead of
    // silently reporting an empty conversation.
    if parsed.messages.is_empty() {
        let fields = proto_wire::parse(&body).unwrap_or_default();
        let has_entries = fields
            .iter()
            .any(|(n, v)| *n == 1 && matches!(v, proto_wire::WireValue::Bytes(_)));
        if has_entries {
            let summary: Vec<String> = fields
                .iter()
                .take(12)
                .map(|(n, v)| format!("{}:{}", n, wire_kind(v)))
                .collect();
            return Err(SteamError::Http(format!(
                "GetRecentMessages: {} entries failed to parse (fields: {})",
                fields.iter().filter(|(n, _)| *n == 1).count(),
                summary.join(", ")
            )));
        }
    }
    Ok(parsed)
}

/// Build the `GetRecentMessages` request protobuf. Extracted so the pagination
/// encoding is unit-testable without an HTTP call.
fn build_recent_messages_request(
    account_steamid: u64,
    partner: u64,
    count: u32,
    older_than: Option<(u32, u32)>,
) -> Vec<u8> {
    let mut request = Writer::new();
    request.fixed64(1, account_steamid);
    request.fixed64(2, partner);
    request.varint(3, count as u64);
    request.bool(4, true); // start_from_most_recent
    if let Some((ts, ordinal)) = older_than {
        request.fixed32(5, ts); // rtime32_start_time
        request.varint(7, ordinal as u64); // start_ordinal
    }
    request.bool(6, true); // request_bbcode
    request.finish()
}

fn wire_kind(v: &proto_wire::WireValue) -> &'static str {
    match v {
        proto_wire::WireValue::Varint(_) => "varint",
        proto_wire::WireValue::Fixed64(_) => "fixed64",
        proto_wire::WireValue::Fixed32(_) => "fixed32",
        proto_wire::WireValue::Bytes(_) => "bytes",
    }
}

fn parse_recent_messages(body: &[u8]) -> Result<RecentMessages> {
    let fields = proto_wire::parse(body).map_err(|e| SteamError::Http(format!("history parse: {}", e)))?;
    let mut messages = Vec::new();
    let mut offset = 0usize;
    while let Some(field) = fields.get(offset) {
        if field.0 != 1 {
            offset += 1;
            continue;
        }
        let bytes = match &field.1 {
            proto_wire::WireValue::Bytes(b) => b.clone(),
            _ => {
                offset += 1;
                continue;
            }
        };
        if let Ok(msg_fields) = proto_wire::parse(&bytes) {
            let account_id = proto_wire::get_number(&msg_fields, 1).unwrap_or(0);
            if account_id > 0 {
                let body = proto_wire::get_string(&msg_fields, 3).unwrap_or_default();
                if !body.trim().is_empty() {
                    messages.push(HistoryMessage {
                        sender_steamid: steamid64_from_account_id(account_id),
                        timestamp: proto_wire::get_number(&msg_fields, 2).unwrap_or(0) as u32,
                        body,
                        ordinal: proto_wire::get_number(&msg_fields, 4).unwrap_or(0) as u32,
                    });
                }
            }
        }
        offset += 1;
    }
    messages.sort_by_key(|m| (m.timestamp, m.ordinal));
    Ok(RecentMessages {
        messages,
        more_available: proto_wire::get_bool(&fields, 4).unwrap_or(false),
    })
}

fn status_error(status: u16) -> SteamError {
    if status == 403 {
        SteamError::Auth("Steam session expired, please log in again".into())
    } else {
        SteamError::Http(format!("HTTP {}", status))
    }
}

// ── Friend list + summaries (OAuth Web API, access-token based) ──

/// One friend relationship from `ISteamUserOAuth/GetFriendList`.
#[derive(Debug, Clone, Deserialize)]
pub struct FriendRelation {
    pub steamid: String,
    pub relationship: String,
    pub friend_since: Option<u64>,
}

/// A player summary from `ISteamUserOAuth/GetUserSummaries`.
#[derive(Debug, Clone, Deserialize)]
pub struct UserSummary {
    pub steamid: String,
    pub personaname: Option<String>,
    pub avatarfull: Option<String>,
    pub personastate: Option<i32>,
    pub gameextrainfo: Option<String>,
    pub lastlogoff: Option<u64>,
}

/// Fetch the account's friend relationships (REST, access token — no key).
pub fn get_friend_list(
    client: &SteamHttpClient,
    access_token: &str,
    steam_id: u64,
) -> Result<Vec<FriendRelation>> {
    let url = format!(
        "{}/ISteamUserOAuth/GetFriendList/v1/?steamid={}&relationship=all&access_token={}",
        API_BASE,
        steam_id,
        percent_encode(access_token)
    );
    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(status_error(response.status()));
    }
    let json: serde_json::Value = response.into_json()?;
    // Steam returns the list under different wrappers depending on the
    // endpoint/variant: `friendslist.friends`, `response.friends`, or a bare
    // top-level `friends` array (the OAuth variant). Accept all three.
    let friends = json["friendslist"]["friends"]
        .as_array()
        .or_else(|| json["response"]["friends"].as_array())
        .or_else(|| json["friends"].as_array())
        .ok_or_else(|| {
            let snippet: String = json.to_string().chars().take(300).collect();
            SteamError::Http(format!(
                "GetFriendList returned an unexpected shape (snippet: {})",
                snippet
            ))
        })?;

    // Manual parse: Steam may emit `friend_since` as a number or a string, and
    // strict serde would silently drop entries on a type mismatch.
    let mut out = Vec::new();
    for f in friends.iter() {
        let steamid = f
            .get("steamid")
            .and_then(serde_json::Value::as_str)
            .map(String::from)
            .or_else(|| {
                f.get("steamid")
                    .and_then(serde_json::Value::as_u64)
                    .map(|v| v.to_string())
            })
            .or_else(|| {
                f.get("ulfriendid")
                    .and_then(serde_json::Value::as_str)
                    .map(String::from)
            })
            .unwrap_or_default();
        if steamid.is_empty() || !steamid.starts_with("7656") {
            continue;
        }
        let relationship = f
            .get("relationship")
            .and_then(serde_json::Value::as_str)
            .map(String::from)
            .or_else(|| {
                f.get("relationship")
                    .and_then(serde_json::Value::as_u64)
                    .map(|v| v.to_string())
            })
            .or_else(|| {
                f.get("efriendrelationship")
                    .and_then(serde_json::Value::as_str)
                    .map(String::from)
            })
            .unwrap_or_default();
        let friend_since = f
            .get("friend_since")
            .and_then(serde_json::Value::as_u64)
            .or_else(|| {
                f.get("friend_since")
                    .and_then(serde_json::Value::as_str)
                    .and_then(|s| s.parse().ok())
            });
        out.push(FriendRelation {
            steamid,
            relationship,
            friend_since,
        });
    }
    Ok(out)
}

/// Fetch player summaries via the OAuth endpoint (no API key needed).
/// Batches of ≤100 steamids per request.
pub fn get_user_summaries(
    client: &SteamHttpClient,
    access_token: &str,
    steam_ids: &[String],
) -> Result<Vec<UserSummary>> {
    let mut all = Vec::new();
    for chunk in steam_ids.chunks(100) {
        let url = format!(
            "{}/ISteamUserOAuth/GetUserSummaries/v1/?steamids={}&access_token={}",
            API_BASE,
            chunk.join(","),
            percent_encode(access_token)
        );
        let response = client.get(&url)?;
        if response.status() != 200 {
            return Err(status_error(response.status()));
        }
        let json: serde_json::Value = response.into_json()?;
        // OAuth variant returns a bare top-level `players` array; the classic
        // endpoint wraps it under `response`.
        let players = json["response"]["players"]
            .as_array()
            .or_else(|| json["players"].as_array())
            .ok_or_else(|| {
                let snippet: String = json.to_string().chars().take(300).collect();
                SteamError::Http(format!(
                    "GetUserSummaries returned an unexpected shape (snippet: {})",
                    snippet
                ))
            })?;
        for p in players.iter() {
            let steamid = p
                .get("steamid")
                .and_then(serde_json::Value::as_str)
                .map(String::from)
                .or_else(|| {
                    p.get("steamid")
                        .and_then(serde_json::Value::as_u64)
                        .map(|v| v.to_string())
                })
                .unwrap_or_default();
            if steamid.is_empty() {
                continue;
            }
            all.push(UserSummary {
                steamid,
                personaname: p.get("personaname").and_then(serde_json::Value::as_str).map(String::from),
                avatarfull: p.get("avatarfull").and_then(serde_json::Value::as_str).map(String::from),
                personastate: p
                    .get("personastate")
                    .and_then(serde_json::Value::as_i64)
                    .map(|v| v as i32)
                    .or_else(|| {
                        p.get("personastate")
                            .and_then(serde_json::Value::as_str)
                            .and_then(|s| s.parse().ok())
                    }),
                gameextrainfo: p.get("gameextrainfo").and_then(serde_json::Value::as_str).map(String::from),
                lastlogoff: p
                    .get("lastlogoff")
                    .and_then(serde_json::Value::as_u64)
                    .or_else(|| {
                        p.get("lastlogoff")
                            .and_then(serde_json::Value::as_str)
                            .and_then(|s| s.parse().ok())
                    }),
            });
        }
    }
    Ok(all)
}

/// RFC 3986 percent-encode for query values.
fn percent_encode(input: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::new();
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push(HEX[(b >> 4) as usize] as char);
                out.push(HEX[(b & 0x0F) as usize] as char);
            }
        }
    }
    out
}

// ── Chat image upload (Steam web-chat flow) ──────────────────

/// Destination for a chat image upload — a friend chat or a group room.
#[derive(Debug, Clone)]
pub enum ChatImageTarget {
    Friend(u64),
    GroupRoom { group_id: u64, chat_id: u64 },
}

const CHAT_UPLOAD_BEGIN_URL: &str = "https://steamcommunity.com/chat/beginfileupload/";
const CHAT_UPLOAD_COMMIT_URL: &str = "https://steamcommunity.com/chat/commitfileupload/";
const MAX_CHAT_IMAGE_BYTES: u64 = 30 * 1024 * 1024;

/// Upload an image into a chat conversation and return its committed CDN URL.
///
/// Mirrors Steam's own web chat: `beginfileupload` reserves a UGC slot and
/// returns a signed cloud URL + headers, the file bytes are `PUT` there, then
/// `commitfileupload` attaches the file to the target conversation (its form
/// fields select the friend / group room). The commit itself inserts the image
/// message — no separate `SendMessage` is needed.
///
/// `steam_id` + `access_token` build the `steamLoginSecure` cookie (Steam's web
/// client sends `||` percent-encoded as `%7C%7C`); `width`/`height` are the
/// source image's pixel dimensions.
pub fn upload_chat_image(
    client: &SteamHttpClient,
    steam_id: u64,
    access_token: &str,
    path: &Path,
    target: &ChatImageTarget,
    width: u32,
    height: u32,
) -> Result<String> {
    let mime = mime_from_path(path)
        .ok_or_else(|| SteamError::General("unsupported image type (use png/jpg/gif/webp)".into()))?;
    let file_name = upload_file_name(path);
    let file_bytes = std::fs::read(path)?;
    if file_bytes.is_empty() {
        return Err(SteamError::General("empty image file".into()));
    }
    if file_bytes.len() as u64 > MAX_CHAT_IMAGE_BYTES {
        return Err(SteamError::General("Steam chat images must be ≤ 30 MB".into()));
    }

    let session_id = random_hex(12);
    // `file_sha` must be the real SHA1 of the uploaded bytes — Steam's commit
    // step verifies it against the stored file (a random value → commit 16).
    let sha = sha1_hex(&file_bytes);
    let sha_upper = sha.to_uppercase();
    let cookie = format!(
        "sessionid={}; steamLoginSecure={}%7C%7C{}",
        session_id, steam_id, access_token
    );

    // 1. Begin: reserve a UGC slot and get the signed cloud upload target.
    let file_size = file_bytes.len().to_string();
    let file_width = width.to_string();
    let file_height = height.to_string();
    let begin_fields = vec![
        ("sessionid", session_id.as_str()),
        ("l", "schinese"),
        ("file_size", file_size.as_str()),
        ("file_name", file_name.as_str()),
        ("file_sha", sha.as_str()),
        ("file_image_width", file_width.as_str()),
        ("file_image_height", file_height.as_str()),
        ("file_type", mime),
    ];
    let begin_text = post_chat_form(client, &cookie, CHAT_UPLOAD_BEGIN_URL, &begin_fields)?;
    let begin: serde_json::Value = serde_json::from_str(&begin_text)
        .map_err(|e| SteamError::Http(format!("beginfileupload: invalid JSON: {}", e)))?;
    // Steam does not always return a top-level `success` here — success is
    // implied by the presence of the upload credentials below. Only an explicit
    // `success:0` (or `false`) counts as a rejection.
    if has_explicit_failure(&begin) {
        return Err(SteamError::Http(format!(
            "beginfileupload rejected (body: {})",
            truncate(&begin_text, 200)
        )));
    }
    let result = begin["result"].as_object().ok_or_else(|| {
        SteamError::Http("beginfileupload returned no result object".into())
    })?;
    let host = result
        .get("url_host")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| SteamError::Http("beginfileupload returned no upload host".into()))?;
    let path_seg = result.get("url_path").and_then(|v| v.as_str()).unwrap_or("");
    let cloud_url = format!(
        "https://{}{}",
        host,
        if path_seg.starts_with('/') {
            path_seg.to_string()
        } else {
            format!("/{}", path_seg)
        }
    );
    // `ugcid` / `timestamp` / `hmac` appear at the top level on live Steam; read
    // them from either location for robustness.
    let ugcid = begin["ugcid"]
        .as_str()
        .or_else(|| result.get("ugcid").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    let timestamp = begin["timestamp"]
        .as_i64()
        .or_else(|| {
            begin["timestamp"]
                .as_str()
                .and_then(|s| s.parse::<i64>().ok())
        })
        .or_else(|| result.get("timestamp").and_then(|v| v.as_i64()))
        .unwrap_or(0);
    let hmac = begin["hmac"]
        .as_str()
        .or_else(|| result.get("hmac").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    if ugcid.is_empty() || timestamp == 0 || hmac.is_empty() {
        return Err(SteamError::Http("beginfileupload returned incomplete upload credentials".into()));
    }
    let mut upload_headers: Vec<(String, String)> = Vec::new();
    if let Some(arr) = result.get("request_headers").and_then(|v| v.as_array()) {
        for header in arr {
            let name = header.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let value = header.get("value").and_then(|v| v.as_str()).unwrap_or("");
            if !name.is_empty() && !is_blocked_upload_header(name) {
                upload_headers.push((name.to_string(), value.to_string()));
            }
        }
    }

    // 2. PUT the file to the signed cloud URL.
    let agent = client.agent();
    let mut put = agent.put(&cloud_url);
    for (name, value) in &upload_headers {
        put = put.set(name, value);
    }
    put = put.set("Content-Type", mime);
    let put_resp = put
        .send_bytes(&file_bytes)
        .map_err(|e| map_ureq_error("cloud upload", e))?;
    if put_resp.status() != 200 {
        return Err(SteamError::Http(format!(
            "cloud upload failed (HTTP {})",
            put_resp.status()
        )));
    }

    // 3. Commit: attach the file to the target conversation.
    let mut commit_fields: Vec<(String, String)> = vec![
        ("sessionid".into(), session_id),
        ("l".into(), "schinese".into()),
        ("file_name".into(), file_name),
        ("file_sha".into(), sha),
        ("file_size".into(), file_size),
        ("file_image_width".into(), file_width),
        ("file_image_height".into(), file_height),
        ("file_type".into(), mime.to_string()),
        ("success".into(), "1".into()),
        ("ugcid".into(), ugcid.clone()),
        ("timestamp".into(), timestamp.to_string()),
        ("hmac".into(), hmac),
    ];
    match target {
        ChatImageTarget::Friend(steam_id) => {
            commit_fields.push(("friend_steamid".into(), steam_id.to_string()));
        }
        ChatImageTarget::GroupRoom { group_id, chat_id } => {
            commit_fields.push(("chat_group_id".into(), group_id.to_string()));
            commit_fields.push(("chat_id".into(), chat_id.to_string()));
        }
    }
    commit_fields.push(("spoiler".into(), "0".into()));

    let commit_pairs: Vec<(&str, &str)> = commit_fields
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let commit_text = post_chat_form(client, &cookie, CHAT_UPLOAD_COMMIT_URL, &commit_pairs)?;
    let commit: serde_json::Value = serde_json::from_str(&commit_text)
        .map_err(|e| SteamError::Http(format!("commitfileupload: invalid JSON: {}", e)))?;
    if has_explicit_failure(&commit) || has_explicit_failure(&commit["result"]) {
        return Err(SteamError::Http(format!(
            "commitfileupload rejected (body: {})",
            truncate(&commit_text, 200)
        )));
    }
    let url = commit["result"]["details"]["url"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| format!("https://images.steamusercontent.com/ugc/{}/{}/", ugcid, sha_upper));
    Ok(url)
}

/// POST a URL-encoded form to `steamcommunity.com/chat/*` with the chat headers
/// (Steam's web client sends these as `application/x-www-form-urlencoded`, not
/// multipart).
fn post_chat_form(
    client: &SteamHttpClient,
    cookie: &str,
    url: &str,
    fields: &[(&str, &str)],
) -> Result<String> {
    let response = client
        .agent()
        .post(url)
        .set("Origin", "https://steamcommunity.com")
        .set("Referer", "https://steamcommunity.com/chat/")
        .set("X-Requested-With", "com.valvesoftware.android.steam.community")
        .set("Cookie", cookie)
        .send_form(fields)
        .map_err(|e| map_ureq_error(url, e))?;
    if response.status() != 200 {
        return Err(SteamError::Http(format!("{} returned HTTP {}", url, response.status())));
    }
    response
        .into_string()
        .map_err(|e| SteamError::Http(format!("{}: failed to read body: {}", url, e)))
}

fn sha1_hex(bytes: &[u8]) -> String {
    let digest = ring::digest::digest(&ring::digest::SHA1_FOR_LEGACY_USE_ONLY, bytes);
    digest.as_ref().iter().map(|b| format!("{:02x}", b)).collect()
}

fn upload_file_name(path: &Path) -> String {
    let base = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let sanitized: String = base
        .chars()
        .map(|c| if c.is_control() || c == '/' || c == '\\' { '_' } else { c })
        .take(180)
        .collect();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{}_{}", ts, sanitized)
}

fn mime_from_path(path: &Path) -> Option<&'static str> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

fn is_blocked_upload_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "host" | "content-length" | "cookie" | "authorization"
    )
}

fn random_hex(bytes: usize) -> String {
    (0..bytes).map(|_| format!("{:02x}", rand::random::<u8>())).collect()
}

/// Steam upload responses flag success as `1` (int) or `true` (bool) depending
/// on endpoint — accept either.
fn json_success(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Number(n) => n.as_i64() == Some(1),
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::String(s) => s == "1" || s.eq_ignore_ascii_case("true"),
        _ => false,
    }
}

/// A present `success` field that is explicitly falsy means the upload was
/// rejected. Absence of the field is NOT a failure — some endpoints (live
/// `beginfileupload`) omit it entirely and signal success via their payload.
fn has_explicit_failure(value: &serde_json::Value) -> bool {
    match value.get("success") {
        Some(s) => !json_success(s),
        None => false,
    }
}

fn map_ureq_error(what: &str, err: ureq::Error) -> SteamError {
    match err {
        ureq::Error::Status(code, response) => {
            let body = response.into_string().unwrap_or_default();
            SteamError::Http(format!("{} failed (HTTP {}): {}", what, code, truncate(&body, 300)))
        }
        e => SteamError::Http(format!("{} failed: {}", what, e)),
    }
}

fn truncate(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        s
    } else {
        &s[..max_len]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steamid64_conversion() {
        assert_eq!(steamid64_from_account_id(12345), 76561197960278073);
        assert_eq!(steamid64_from_account_id(0), 76561197960265728);
    }

    #[test]
    fn percent_encode_text() {
        assert_eq!(percent_encode("hello world"), "hello%20world");
        assert_eq!(percent_encode("a&b=1"), "a%26b%3D1");
    }

    #[test]
    fn parse_history_response() {
        // Response: field 1 (bytes) = a message {1: accountid, 2: ts, 3: body, 4: ordinal};
        // field 4 = more_available bool.
        let mut msg = Writer::new();
        msg.varint(1, 12345);
        msg.varint(2, 1700000001);
        msg.string(3, "hello");
        msg.varint(4, 0);
        let msg = msg.finish();

        let mut resp = Writer::new();
        resp.bytes(1, &msg);
        resp.bool(4, true);
        let resp = resp.finish();

        let parsed = parse_recent_messages(&resp).unwrap();
        assert_eq!(parsed.messages.len(), 1);
        assert_eq!(parsed.messages[0].sender_steamid, 76561197960278073);
        assert_eq!(parsed.messages[0].timestamp, 1700000001);
        assert_eq!(parsed.messages[0].body, "hello");
        assert!(parsed.more_available);
    }

    #[test]
    fn empty_history() {
        let mut resp = Writer::new();
        resp.bool(4, false);
        let parsed = parse_recent_messages(&resp.finish()).unwrap();
        assert!(parsed.messages.is_empty());
        assert!(!parsed.more_available);
    }

    #[test]
    fn recent_messages_request_no_older_than() {
        let buf = build_recent_messages_request(76561198000000001, 76561198000000002, 50, None);
        let fields = proto_wire::parse(&buf).unwrap();
        assert_eq!(proto_wire::get_fixed64(&fields, 1), Some(76561198000000001));
        assert_eq!(proto_wire::get_fixed64(&fields, 2), Some(76561198000000002));
        assert_eq!(proto_wire::get_varint(&fields, 3), Some(50));
        assert_eq!(proto_wire::get_bool(&fields, 4), Some(true));
        assert_eq!(proto_wire::get_bool(&fields, 6), Some(true));
        // No pagination fields when not requested.
        assert!(proto_wire::get_fixed32(&fields, 5).is_none());
        assert!(proto_wire::get_varint(&fields, 7).is_none());
    }

    #[test]
    fn recent_messages_request_with_older_than() {
        let buf = build_recent_messages_request(
            76561198000000001,
            76561198000000002,
            50,
            Some((1700000000, 3)),
        );
        let fields = proto_wire::parse(&buf).unwrap();
        // rtime32_start_time (field 5, fixed32) + start_ordinal (field 7, varint).
        assert_eq!(proto_wire::get_fixed32(&fields, 5), Some(1700000000));
        assert_eq!(proto_wire::get_varint(&fields, 7), Some(3));
        assert_eq!(proto_wire::get_bool(&fields, 4), Some(true));
        assert_eq!(proto_wire::get_bool(&fields, 6), Some(true));
    }

    #[test]
    fn parse_friend_list_response() {
        // Steam's real shape: { "friendslist": { "friends": [...] } }.
        let json = r#"{
            "friendslist": {
                "friends": [
                    { "steamid": "76561198000000001", "relationship": "friend", "friend_since": 1700000000 },
                    { "steamid": "76561198000000002", "relationship": "pending", "friend_since": 0 }
                ]
            }
        }"#;
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        let friends = value["friendslist"]["friends"]
            .as_array()
            .cloned()
            .or_else(|| value["response"]["friends"].as_array().cloned())
            .unwrap_or_default();
        let list: Vec<FriendRelation> = friends
            .iter()
            .filter_map(|f| serde_json::from_value(f.clone()).ok())
            .collect();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].relationship, "friend");
        assert_eq!(list[0].steamid, "76561198000000001");
        assert_eq!(list[0].friend_since, Some(1700000000));
        assert_eq!(list[1].relationship, "pending");
    }

    #[test]
    fn parse_friend_list_response_wrapped() {
        // Some variants wrap the list under `response`.
        let json = r#"{
            "response": { "friends": [ { "steamid": "76561198000000001", "relationship": "friend" } ] }
        }"#;
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        let friends = value["friendslist"]["friends"]
            .as_array()
            .or_else(|| value["response"]["friends"].as_array())
            .or_else(|| value["friends"].as_array())
            .expect("friends array");
        assert_eq!(friends.len(), 1);
    }

    #[test]
    fn parse_friend_list_bare_top_level() {
        // The OAuth variant returns a bare top-level `friends` array — the
        // shape observed on a live account.
        let json = r#"{
            "friends": [
                { "friend_since": 1728827548, "relationship": "requestrecipient", "steamid": "76561198055210680" },
                { "friend_since": 1600380514, "relationship": "friend", "steamid": "76561199065897902" }
            ]
        }"#;
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        let friends = value["friendslist"]["friends"]
            .as_array()
            .or_else(|| value["response"]["friends"].as_array())
            .or_else(|| value["friends"].as_array())
            .unwrap();
        let list: Vec<FriendRelation> = friends
            .iter()
            .filter_map(|f| serde_json::from_value(f.clone()).ok())
            .collect();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].relationship, "requestrecipient");
        assert_eq!(list[1].relationship, "friend");
        assert_eq!(list[1].steamid, "76561199065897902");
        assert_eq!(list[1].friend_since, Some(1600380514));
    }

    #[test]
    fn parse_user_summaries_response() {
        // OAuth variant returns a bare top-level `players` array.
        let json = r#"{
            "players": [
                {
                    "steamid": "76561198000000001",
                    "personaname": "Alice",
                    "avatarfull": "https://x/a.jpg",
                    "personastate": 1,
                    "gameextrainfo": "CS2",
                    "lastlogoff": 1700000000
                }
            ]
        }"#;
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        let players = value["response"]["players"]
            .as_array()
            .or_else(|| value["players"].as_array())
            .unwrap();
        let p = &players[0];
        let summary = UserSummary {
            steamid: p["steamid"].as_str().unwrap().to_string(),
            personaname: p["personaname"].as_str().map(String::from),
            avatarfull: p["avatarfull"].as_str().map(String::from),
            personastate: p["personastate"].as_i64().map(|v| v as i32),
            gameextrainfo: p["gameextrainfo"].as_str().map(String::from),
            lastlogoff: p["lastlogoff"].as_u64(),
        };
        assert_eq!(summary.steamid, "76561198000000001");
        assert_eq!(summary.personaname.as_deref(), Some("Alice"));
        assert_eq!(summary.personastate, Some(1));
        assert_eq!(summary.gameextrainfo.as_deref(), Some("CS2"));
        assert_eq!(summary.lastlogoff, Some(1700000000));
    }

    #[test]
    fn sha1_hex_vector() {
        // RFC 3174 test vector: SHA1("abc").
        assert_eq!(
            sha1_hex(b"abc"),
            "a9993e364706816aba3e25717850c26c9cd0d89d"
        );
        assert_eq!(sha1_hex(b""), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
    }

    #[test]
    fn mime_and_header_filtering() {
        assert_eq!(mime_from_path(Path::new("a.JPG")), Some("image/jpeg"));
        assert_eq!(mime_from_path(Path::new("x.png")), Some("image/png"));
        assert_eq!(mime_from_path(Path::new("x.gif")), Some("image/gif"));
        assert_eq!(mime_from_path(Path::new("x.bin")), None);
        assert!(is_blocked_upload_header("Host"));
        assert!(is_blocked_upload_header("content-length"));
        assert!(is_blocked_upload_header("Cookie"));
        assert!(is_blocked_upload_header("Authorization"));
        assert!(!is_blocked_upload_header("x-goog-algorithm"));
    }

    #[test]
    fn sanitize_upload_name() {
        let name = upload_file_name(Path::new("C:\\tmp\\my photo.png"));
        assert!(name.ends_with("_my photo.png"));
        assert!(name.len() > 30, "has a nano-time prefix");
        assert!(!name.contains('\\'));
    }
}
