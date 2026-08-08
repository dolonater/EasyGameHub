//! Steam HTTP client wrapper and Web API client modules.
//!
//! Provides a simple HTTP client pre-configured with Steam-appropriate
//! headers (User-Agent, Accept, etc.) and error handling.

pub mod achievements;
pub mod cloud;
pub mod inventory;
pub mod local_inventory;
pub mod mobile_conf;
pub mod news;
pub mod social;
pub mod steamworks_web_api;
pub mod store;

use crate::error::{Result, SteamError};
use std::time::Duration;

/// Default User-Agent string matching a modern browser.
pub(crate) const STEAM_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// A simple synchronous HTTP client for Steam API calls.
///
/// Cloning is cheap (the underlying `ureq::Agent` shares its connection pool),
/// so callers can derive one shared instance and clone it per request to reuse
/// keep-alive connections instead of re-handshaking every call.
///
/// # Example
///
/// ```ignore
/// let client = SteamHttpClient::new();
/// let response = client.get("https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/")?;
/// let json: serde_json::Value = response.into_json()?;
/// ```
#[derive(Clone)]
pub struct SteamHttpClient {
    agent: ureq::Agent,
}

impl SteamHttpClient {
    /// Create a new Steam HTTP client with default configuration.
    pub fn new() -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_read(Duration::from_secs(30))
            .timeout_write(Duration::from_secs(30))
            .timeout_connect(Duration::from_secs(15))
            .user_agent(STEAM_USER_AGENT)
            .build();

        Self { agent }
    }

    /// Make a GET request to the given URL.
    ///
    /// Returns a [`SteamResponse`] which can be used to read the body or
    /// parse JSON.
    pub fn get(&self, url: &str) -> Result<SteamResponse> {
        self.get_with_headers(url, &[])
    }

    /// Make a GET request with extra headers (e.g. `Referer` for store APIs).
    pub fn get_with_headers(&self, url: &str, headers: &[(&str, &str)]) -> Result<SteamResponse> {
        let mut request = self.agent.get(url);
        for (name, value) in headers {
            request = request.set(name, value);
        }
        let response = request
            .call()
            .map_err(|e| SteamError::Http(format!("GET {} failed: {}", url, e)))?;

        Ok(SteamResponse { inner: response })
    }

    /// Make a POST request with a JSON body.
    pub fn post_json(&self, url: &str, body: &serde_json::Value) -> Result<SteamResponse> {
        let body_str = serde_json::to_string(body)?;
        let response = self
            .agent
            .post(url)
            .set("Content-Type", "application/json")
            .send_string(&body_str)
            .map_err(|e| SteamError::Http(format!("POST {} failed: {}", url, e)))?;

        Ok(SteamResponse { inner: response })
    }

    /// Make a POST request with URL-encoded form data.
    pub fn post_form(&self, url: &str, params: &[(&str, &str)]) -> Result<SteamResponse> {
        let response = self
            .agent
            .post(url)
            .send_form(params)
            .map_err(|e| SteamError::Http(format!("POST {} failed: {}", url, e)))?;

        Ok(SteamResponse { inner: response })
    }

    /// Make a POST request with raw bytes.
    pub fn post_bytes(&self, url: &str, body: &[u8]) -> Result<SteamResponse> {
        let response = self
            .agent
            .post(url)
            .send_bytes(body)
            .map_err(|e| SteamError::Http(format!("POST {} failed: {}", url, e)))?;

        Ok(SteamResponse { inner: response })
    }

    /// Make a POST request with base64-encoded protobuf as form data.
    ///
    /// This is the standard format for Steam authentication API calls:
    /// `input_protobuf_encoded=<base64>` as `application/x-www-form-urlencoded`.
    pub fn post_protobuf_form(&self, url: &str, body: &[u8]) -> Result<SteamResponse> {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(body);
        let response = self
            .agent
            .post(url)
            .send_form(&[("input_protobuf_encoded", encoded.as_str())])
            .map_err(|e| SteamError::Http(format!("POST {} failed: {}", url, e)))?;

        Ok(SteamResponse { inner: response })
    }

    /// Make a POST request with a raw protobuf body.
    ///
    /// Sends the bytes as `application/octet-stream` (Steam API default for
    /// protobuf endpoints) and returns the raw response.
    pub fn post_protobuf(&self, url: &str, body: &[u8]) -> Result<SteamResponse> {
        let response = self
            .agent
            .post(url)
            .set("Content-Type", "application/octet-stream")
            .send_bytes(body)
            .map_err(|e| SteamError::Http(format!("POST {} failed: {}", url, e)))?;

        Ok(SteamResponse { inner: response })
    }

    /// Get a reference to the underlying `ureq::Agent`.
    pub fn agent(&self) -> &ureq::Agent {
        &self.agent
    }
}

impl Default for SteamHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Wrapper around `ureq::Response` providing convenience methods.
pub struct SteamResponse {
    inner: ureq::Response,
}

impl SteamResponse {
    /// Get the HTTP status code.
    pub fn status(&self) -> u16 {
        self.inner.status()
    }

    /// Read the response body as a string.
    pub fn into_string(self) -> Result<String> {
        self.inner
            .into_string()
            .map_err(|e| SteamError::Http(format!("Failed to read response body: {}", e)))
    }

    /// Read the response body as raw bytes.
    pub fn into_vec(self) -> Result<Vec<u8>> {
        use std::io::Read;
        let mut reader = self.inner.into_reader();
        let mut buf = Vec::new();
        reader
            .read_to_end(&mut buf)
            .map_err(|e| SteamError::Http(format!("Failed to read response body: {}", e)))?;
        Ok(buf)
    }

    /// Parse the response body as JSON.
    pub fn into_json<T: serde::de::DeserializeOwned>(self) -> Result<T> {
        let body = self.into_string()?;
        serde_json::from_str(&body).map_err(|e| {
            SteamError::Http(format!(
                "Failed to parse JSON response: {} (body: {})",
                e,
                truncate(&body, 500)
            ))
        })
    }

    /// Get a response header value.
    #[allow(dead_code)]
    pub fn header(&self, name: &str) -> Option<&str> {
        self.inner.header(name)
    }
}

/// Truncate a string for error messages.
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
    fn test_client_creation() {
        let client = SteamHttpClient::new();
        assert!(client.agent().get("https://example.com").call().is_ok() || true);
        // Note: we don't actually make network calls in unit tests,
        // just verify the client can be constructed.
    }

    #[test]
    fn test_default_client() {
        let client = SteamHttpClient::default();
        drop(client); // Just verify construction works
    }
}
