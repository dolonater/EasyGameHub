//! CM bootstrap: resolve the chat web-logon token and the WebSocket CM server
//! list for the account.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};

/// Fetch the chat web-logon token via `steamcommunity.com/chat/clientjstoken`.
///
/// The request is authenticated with a `steamLoginSecure=<steamid>||<token>`
/// cookie (the access token), mirroring what Steam's own web chat does, and
/// needs the `X-Requested-With` header Steam uses to identify its clients. The
/// returned `token` is sent in `CMsgClientLogon`.
pub fn fetch_web_logon_token(
    client: &SteamHttpClient,
    access_token: &str,
    steam_id: u64,
) -> Result<String> {
    let cookie = format!("steamLoginSecure={}||{}", steam_id, access_token);
    let response = client.get_with_headers(
        "https://steamcommunity.com/chat/clientjstoken",
        &[
            ("Cookie", cookie.as_str()),
            ("Referer", "https://steamcommunity.com/chat/"),
            (
                "X-Requested-With",
                "com.valvesoftware.android.steam.community",
            ),
        ],
    )?;
    if response.status() != 200 {
        return Err(status_error(response.status()));
    }
    let json: serde_json::Value = response.into_json()?;
    if json.get("logged_in").and_then(|v| v.as_bool()) != Some(true) {
        return Err(SteamError::Auth(
            "Steam chat web session expired, please log in again".into(),
        ));
    }
    json.get("token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .ok_or_else(|| SteamError::NotFound("no chat web logon token returned".into()))
}

/// Fetch the WebSocket CM endpoints (hosts, port 443), sorted by load.
///
/// `GetCMListForConnect` is public (no key). Only `websockets` +
/// `steamglobal` entries with a 443/absent port are kept; the returned hosts
/// are connected as `wss://<host>/cmsocket/`.
pub fn fetch_endpoints(client: &SteamHttpClient) -> Result<Vec<String>> {
    let url = "https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0&cmtype=websockets&origin=https%3A%2F%2Fsteamcommunity.com";
    let response = client.get(url)?;
    if response.status() != 200 {
        return Err(status_error(response.status()));
    }
    let json: serde_json::Value = response.into_json()?;
    let list = json["response"]["serverlist"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut endpoints: Vec<(String, f64)> = list
        .into_iter()
        .filter_map(|server| {
            let endpoint = server.get("endpoint").and_then(|v| v.as_str())?;
            let kind = server.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let realm = server.get("realm").and_then(|v| v.as_str()).unwrap_or("");
            if kind != "websockets" || realm != "steamglobal" {
                return None;
            }
            // Only hosts on the default wss port (443).
            let (host, port) = split_host_port(endpoint)?;
            if port != 443 {
                return None;
            }
            let load = server
                .get("wtd_load")
                .and_then(|v| v.as_f64())
                .unwrap_or(f64::MAX);
            Some((host, load))
        })
        .collect();

    endpoints.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    let mut seen = std::collections::HashSet::new();
    Ok(endpoints
        .into_iter()
        .map(|(host, _)| host)
        .filter(|host| seen.insert(host.clone()))
        .collect())
}

/// Split an `endpoint` string into `(host, port)`. A trailing numeric port is
/// honoured; otherwise the default wss port (443) is assumed.
fn split_host_port(endpoint: &str) -> Option<(String, u16)> {
    let trimmed = endpoint.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(idx) = trimmed.rfind(':') {
        let (host, port_str) = (&trimmed[..idx], &trimmed[idx + 1..]);
        if !host.is_empty() && !port_str.is_empty() && port_str.chars().all(|c| c.is_ascii_digit())
        {
            return Some((host.to_string(), port_str.parse::<u16>().ok()?));
        }
    }
    Some((trimmed.to_string(), 443))
}

fn status_error(status: u16) -> SteamError {
    if status == 403 {
        SteamError::Auth("Steam session expired, please log in again".into())
    } else {
        SteamError::Http(format!("HTTP {}", status))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_port_split() {
        assert_eq!(
            split_host_port("cm1-ord1.steamserver.net").unwrap().0,
            "cm1-ord1.steamserver.net"
        );
        assert_eq!(split_host_port("cm1-ord1.steamserver.net").unwrap().1, 443);
        assert_eq!(
            split_host_port("cmp2-seo1.steamserver.net:27020")
                .unwrap()
                .1,
            27020
        );
        assert_eq!(split_host_port("cm3.steamserver.net:443").unwrap().1, 443);
        assert!(split_host_port("").is_none());
    }

    #[test]
    fn endpoint_selection_drops_non_443() {
        let servers = serde_json::json!({
            "response": { "serverlist": [
                { "endpoint": "cm1-ord1.steamserver.net", "type": "websockets", "realm": "steamglobal", "wtd_load": 5.0 },
                { "endpoint": "cmp2-seo1.steamserver.net:27020", "type": "websockets", "realm": "steamglobal", "wtd_load": 1.0 },
                { "endpoint": "cm5.steamserver.net:443", "type": "websockets", "realm": "steamglobal", "wtd_load": 3.0 },
                { "endpoint": "other.example.com", "type": "tcp", "realm": "steamglobal", "wtd_load": 0.5 }
            ]}
        });
        // Simulate the filtering logic by re-running the same parse inline.
        let list = servers["response"]["serverlist"].as_array().unwrap();
        let mut picked: Vec<(String, f64)> = list
            .iter()
            .filter_map(|s| {
                let endpoint = s.get("endpoint").and_then(|v| v.as_str())?;
                let kind = s.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let realm = s.get("realm").and_then(|v| v.as_str()).unwrap_or("");
                if kind != "websockets" || realm != "steamglobal" {
                    return None;
                }
                let (host, port) = split_host_port(endpoint)?;
                if port != 443 {
                    return None;
                }
                Some((
                    host,
                    s.get("wtd_load")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(f64::MAX),
                ))
            })
            .collect();
        picked.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let hosts: Vec<String> = picked.into_iter().map(|(h, _)| h).collect();
        assert_eq!(
            hosts,
            vec![
                "cm5.steamserver.net".to_string(),
                "cm1-ord1.steamserver.net".to_string()
            ]
        );
    }
}
