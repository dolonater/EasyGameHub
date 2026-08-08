//! Steam mobile confirmation key derivation and request URL builders.
//!
//! Steam's mobile confirmation protocol (shared with steamguard-cli /
//! SteamKit): the request key is
//! `base64( HMAC-SHA1(identity_secret, tag || \0 || time_le8) ) || hex(time_le8)`
//! where `time` is the unix timestamp serialized as 8-byte little-endian.
//! The tag is `"conf"` for both the list request and allow/deny actions; the
//! per-item `ck` parameter uses the `key` field returned by the list response,
//! not a re-derived value.

use base64::Engine;

/// Derive the Steam mobile confirmation key for a request.
pub fn generate_confirmation_key(identity_secret: &[u8], tag: &str, time: u64) -> String {
    let mut buffer = Vec::with_capacity(tag.len() + 9);
    buffer.extend_from_slice(tag.as_bytes());
    buffer.push(0);
    buffer.extend_from_slice(&time.to_le_bytes());

    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA1_FOR_LEGACY_USE_ONLY, identity_secret);
    let hash = ring::hmac::sign(&key, &buffer);

    let mut out = base64::engine::general_purpose::STANDARD.encode(hash.as_ref());
    out.push_str(&hex_le(time));
    out
}

/// Derive a stable per-account `sessionid` cookie value from the device id
/// (SHA-256 → 32 hex chars). Steam treats the sessionid as opaque; a value
/// stable across the getlist / allow / deny calls is all that matters, so a
/// deterministic derivation avoids extra storage.
pub fn session_id_from_device_id(device_id: &str) -> String {
    use ring::digest::{digest, SHA256};
    let hash = digest(&SHA256, device_id.as_bytes());
    hash.as_ref()[..16]
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

/// Build the `mobileconf/getlist` URL.
pub fn build_getlist_url(
    device_id: &str,
    steam_id: u64,
    conf_key: &str,
    time: u64,
    access_token: &str,
) -> String {
    format!(
        "https://steamcommunity.com/mobileconf/getlist?p={}&a={}&k={}&t={}&m=android&tag=conf&access_token={}",
        device_id,
        steam_id,
        conf_key,
        time,
        percent_encode(access_token)
    )
}

/// Build the `mobileconf/allow` or `mobileconf/deny` URL. `confirmation_key`
/// is the per-item `key` field from the getlist response.
pub fn build_action_url(
    action: &str,
    device_id: &str,
    steam_id: u64,
    conf_key: &str,
    time: u64,
    confirmation_id: &str,
    confirmation_key: &str,
    access_token: &str,
) -> String {
    format!(
        "https://steamcommunity.com/mobileconf/{}?p={}&a={}&k={}&t={}&m=android&tag=conf&cid={}&ck={}&access_token={}",
        action,
        device_id,
        steam_id,
        conf_key,
        time,
        confirmation_id,
        confirmation_key,
        percent_encode(access_token)
    )
}

/// Percent-encode a string per RFC 3986 (unreserved chars kept as-is).
fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn hex_le(time: u64) -> String {
    time.to_le_bytes()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirmation_key_kat_20b() {
        // Vector cross-verified against an independent reference
        // implementation (HMAC-SHA1 over tag\0+time_le, base64 then hex_le).
        let key = generate_confirmation_key(b"0123456789abcdef0123", "conf", 1234567890);
        assert_eq!(key, "EHlj4IdsI72zcbIKwGp5xp/GPPo=d202964900000000");
    }

    #[test]
    fn confirmation_key_kat_16b() {
        let key = generate_confirmation_key(b"abcdef0123456789", "conf", 1700000000);
        assert_eq!(key, "tqryj8giFx6g3s+KfyTByB24Nm0=00f1536500000000");
    }

    #[test]
    fn getlist_url_structure() {
        let url = build_getlist_url(
            "android:0123456789abcdef",
            76561198000000000,
            "K-KEY",
            1234567890,
            "tok.en.abc",
        );
        assert_eq!(
            url,
            "https://steamcommunity.com/mobileconf/getlist?p=android:0123456789abcdef&a=76561198000000000&k=K-KEY&t=1234567890&m=android&tag=conf&access_token=tok.en.abc"
        );
    }

    #[test]
    fn action_url_structure() {
        let url = build_action_url(
            "allow",
            "android:0123456789abcdef",
            76561198000000000,
            "K-KEY",
            1234567890,
            "1234",
            "CK-VAL",
            "tok.en.abc",
        );
        assert_eq!(
            url,
            "https://steamcommunity.com/mobileconf/allow?p=android:0123456789abcdef&a=76561198000000000&k=K-KEY&t=1234567890&m=android&tag=conf&cid=1234&ck=CK-VAL&access_token=tok.en.abc"
        );
    }

    #[test]
    fn percent_encode_token() {
        assert_eq!(percent_encode("abc123-_~"), "abc123-_~");
        assert_eq!(percent_encode("a/b c"), "a%2Fb%20c");
    }
}
