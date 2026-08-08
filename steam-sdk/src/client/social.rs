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

/// Fetch the last `count` messages exchanged with a friend.
///
/// GET `IFriendMessagesService/GetRecentMessages/v1` with the request encoded
/// as `input_protobuf_encoded`. Requires a valid session `access_token`.
pub fn get_recent_messages(
    client: &SteamHttpClient,
    access_token: &str,
    account_steamid: u64,
    partner: u64,
    count: u32,
) -> Result<RecentMessages> {
    let mut request = Writer::new();
    request.fixed64(1, account_steamid);
    request.fixed64(2, partner);
    request.varint(3, count as u64);
    request.bool(4, true); // start_from_most_recent
    request.bool(6, true); // request_bbcode
    let request_bytes = request.finish();
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
}
