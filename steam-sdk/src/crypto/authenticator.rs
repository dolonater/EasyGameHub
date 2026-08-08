//! Authenticator entry storage and management.
//!
//! Manages stored 2FA authenticator entries (Steam, Google, Microsoft, etc.)
//! with encrypted secret storage via [`SecureStore`].

use super::secure_store::SecureStore;
use super::totp::{self, OtpAlgorithm, TokenType};
use crate::error::{Result, SteamError};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A stored authenticator entry containing all info needed to generate codes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthEntry {
    /// Unique identifier (UUID).
    pub id: String,
    /// Issuer name (e.g. "Steam", "Google", "Microsoft").
    pub issuer: String,
    /// Account name or email associated with this entry.
    pub account_name: String,
    /// Type of token.
    pub token_type: TokenTypeSerde,
    /// Hash algorithm.
    pub algorithm: OtpAlgorithmSerde,
    /// Number of digits in the generated code (6 for most, 5 for Steam).
    pub digits: u8,
    /// Time step in seconds (30 for TOTP, 0 for HOTP).
    pub period: u64,
    /// Counter value (HOTP only).
    pub counter: u64,
    /// Server time offset in seconds (to correct clock skew).
    pub time_offset: i64,
    /// Encrypted shared secret (stored in SecureStore, not serialized directly).
    #[serde(skip)]
    pub secret_encrypted: Vec<u8>,
    /// When this entry was created.
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Serial number (Steam-specific, for trade confirmations).
    pub serial_number: Option<String>,
    /// Device ID (for Steam tokens).
    pub device_id: Option<String>,
    /// Whether this entry is currently active.
    pub is_active: bool,
    /// Steam identity secret (raw bytes, encrypted at rest via SecureStore).
    /// Required for mobile confirmations; empty when the maFile lacked it.
    #[serde(skip)]
    pub identity_secret_encrypted: Vec<u8>,
    /// Steam account ID (from maFile `steam_id`), used to bind an entry to a
    /// logged-in session for confirmations.
    pub steam_id: Option<String>,
    /// maFile `revocation_code` (removal code), optional, for maFile export.
    pub revocation_code: Option<String>,
}

// Serde-compatible enums
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TokenTypeSerde {
    Totp,
    Hotp,
    Steam,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OtpAlgorithmSerde {
    Sha1,
    Sha256,
    Sha512,
}

impl From<TokenTypeSerde> for TokenType {
    fn from(t: TokenTypeSerde) -> Self {
        match t {
            TokenTypeSerde::Totp => TokenType::Totp,
            TokenTypeSerde::Hotp => TokenType::Hotp,
            TokenTypeSerde::Steam => TokenType::Steam,
        }
    }
}

impl From<TokenType> for TokenTypeSerde {
    fn from(t: TokenType) -> Self {
        match t {
            TokenType::Totp => TokenTypeSerde::Totp,
            TokenType::Hotp => TokenTypeSerde::Hotp,
            TokenType::Steam => TokenTypeSerde::Steam,
        }
    }
}

impl From<OtpAlgorithmSerde> for OtpAlgorithm {
    fn from(a: OtpAlgorithmSerde) -> Self {
        match a {
            OtpAlgorithmSerde::Sha1 => OtpAlgorithm::Sha1,
            OtpAlgorithmSerde::Sha256 => OtpAlgorithm::Sha256,
            OtpAlgorithmSerde::Sha512 => OtpAlgorithm::Sha512,
        }
    }
}

impl From<OtpAlgorithm> for OtpAlgorithmSerde {
    fn from(a: OtpAlgorithm) -> Self {
        match a {
            OtpAlgorithm::Sha1 => OtpAlgorithmSerde::Sha1,
            OtpAlgorithm::Sha256 => OtpAlgorithmSerde::Sha256,
            OtpAlgorithm::Sha512 => OtpAlgorithmSerde::Sha512,
        }
    }
}

/// Manager for authenticator entries with encrypted secret storage.
pub struct AuthEntryManager {
    store: SecureStore,
    entries: Vec<AuthEntry>,
}

impl AuthEntryManager {
    /// Open the authenticator store.
    pub fn open(path: &Path) -> Result<Self> {
        let store = SecureStore::open(path)?;
        let entries = Self::load_entries(&store)?;
        Ok(Self { store, entries })
    }

    fn load_entries(store: &SecureStore) -> Result<Vec<AuthEntry>> {
        let data = store.get("auth_entries")?;
        // Data is stored as (metadata_json, encrypted_secret) pairs
        match data {
            Some(bytes) => {
                let entries: Vec<AuthEntry> = serde_json::from_slice(&bytes)?;
                // Load encrypted secrets for each entry
                let mut result = Vec::new();
                for mut entry in entries {
                    let secret_key = format!("secret_{}", entry.id);
                    if let Some(secret) = store.get(&secret_key)? {
                        entry.secret_encrypted = secret;
                    }
                    let identity_key = format!("identity_secret_{}", entry.id);
                    if let Some(secret) = store.get(&identity_key)? {
                        entry.identity_secret_encrypted = secret;
                    }
                    result.push(entry);
                }
                Ok(result)
            }
            None => Ok(Vec::new()),
        }
    }

    fn save_entries(&mut self) -> Result<()> {
        // Save metadata (without secrets)
        let entries_json = serde_json::to_vec(&self.entries)?;
        self.store.set("auth_entries", &entries_json)?;

        // Save each secret individually
        for entry in &self.entries {
            let secret_key = format!("secret_{}", entry.id);
            self.store.set(&secret_key, &entry.secret_encrypted)?;
            let identity_key = format!("identity_secret_{}", entry.id);
            self.store.set(&identity_key, &entry.identity_secret_encrypted)?;
        }

        Ok(())
    }

    /// Add a new authenticator entry.
    pub fn add_entry(&mut self, entry: AuthEntry) -> Result<()> {
        self.entries.push(entry);
        self.save_entries()
    }

    /// Remove an entry by ID.
    pub fn remove_entry(&mut self, id: &str) -> Result<()> {
        self.entries.retain(|e| e.id != id);
        // Clean up secrets
        let secret_key = format!("secret_{}", id);
        let _ = self.store.remove(&secret_key);
        let identity_key = format!("identity_secret_{}", id);
        let _ = self.store.remove(&identity_key);
        self.save_entries()
    }

    /// Get all entries.
    pub fn all_entries(&self) -> &[AuthEntry] {
        &self.entries
    }

    /// Get a specific entry by ID.
    pub fn get_entry(&self, id: &str) -> Option<&AuthEntry> {
        self.entries.iter().find(|e| e.id == id)
    }

    /// Get a mutable reference to an entry.
    pub fn get_entry_mut(&mut self, id: &str) -> Option<&mut AuthEntry> {
        self.entries.iter_mut().find(|e| e.id == id)
    }

    /// Update an entry's counter (for HOTP).
    pub fn increment_counter(&mut self, id: &str) -> Result<()> {
        if let Some(entry) = self.get_entry_mut(id) {
            entry.counter += 1;
            self.save_entries()?;
        }
        Ok(())
    }

    /// Set the time offset for an entry.
    pub fn set_time_offset(&mut self, id: &str, offset: i64) -> Result<()> {
        if let Some(entry) = self.get_entry_mut(id) {
            entry.time_offset = offset;
            self.save_entries()?;
        }
        Ok(())
    }

    /// Import an entry from a .maFile (Steam mobile authenticator export).
    ///
    /// The .maFile is a JSON file containing `shared_secret`, `serial_number`,
    /// `device_id`, `identity_secret`, `account_name`, etc.
    pub fn import_mafile(&mut self, json_content: &str) -> Result<&AuthEntry> {
        let parsed: serde_json::Value = serde_json::from_str(json_content)?;

        let account_name = parsed
            .get("account_name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");
        let shared_secret = parsed
            .get("shared_secret")
            .and_then(|v| v.as_str())
            .ok_or_else(|| SteamError::NotFound("shared_secret not found in .maFile".into()))?;
        let serial = parsed.get("serial_number").and_then(|v| v.as_str());
        let device_id = parsed.get("device_id").and_then(|v| v.as_str());
        // identity_secret is optional: a maFile without it still imports (TOTP
        // codes work), only mobile confirmations need it. A decode failure is
        // treated as absent rather than failing the whole import.
        let identity_secret = parsed
            .get("identity_secret")
            .and_then(|v| v.as_str())
            .and_then(|s| base64_decode(s).ok());
        let steam_id = parsed
            .get("steam_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let revocation_code = parsed
            .get("revocation_code")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Decode the Base64 shared secret (Steam .maFile uses Base64, not Base32)
        let secret = base64_decode(shared_secret)?;

        let entry = AuthEntry {
            id: uuid_v4(),
            issuer: "Steam".into(),
            account_name: account_name.to_string(),
            token_type: TokenTypeSerde::Steam,
            algorithm: OtpAlgorithmSerde::Sha1,
            digits: 5,
            period: 30,
            counter: 0,
            time_offset: 0,
            secret_encrypted: secret,
            created_at: chrono::Utc::now(),
            serial_number: serial.map(|s| s.to_string()),
            device_id: device_id.map(|s| s.to_string()),
            is_active: true,
            identity_secret_encrypted: identity_secret.unwrap_or_default(),
            steam_id,
            revocation_code,
        };

        let id = entry.id.clone();
        self.add_entry(entry)?;
        self.get_entry(&id)
            .ok_or_else(|| SteamError::NotFound("entry not found after import".into()))
    }

    /// Generate the current code for an entry.
    pub fn generate_code(&self, id: &str) -> Result<String> {
        let entry = self
            .get_entry(id)
            .ok_or_else(|| SteamError::NotFound(format!("auth entry '{}' not found", id)))?;

        let token_type: TokenType = entry.token_type.clone().into();
        let algorithm: OtpAlgorithm = entry.algorithm.clone().into();

        match token_type {
            TokenType::Steam => {
                totp::generate_steam_totp(&entry.secret_encrypted, entry.time_offset)
                    .map_err(|e| SteamError::Crypto(e))
            }
            TokenType::Totp => totp::generate_totp(
                &entry.secret_encrypted,
                entry.period.max(1),
                entry.digits,
                algorithm,
                entry.time_offset,
            )
            .map_err(|e| SteamError::Crypto(e)),
            TokenType::Hotp => {
                let code = totp::generate_hotp(
                    &entry.secret_encrypted,
                    entry.counter,
                    entry.digits,
                    algorithm,
                )
                .map_err(|e| SteamError::Crypto(e))?;
                // Increment counter after generating
                // Note: we can't call self.increment_counter because of borrow
                Ok(code)
            }
        }
    }

    /// Get remaining seconds in the current TOTP period.
    pub fn remaining_seconds(&self, id: &str) -> Result<u64> {
        let entry = self
            .get_entry(id)
            .ok_or_else(|| SteamError::NotFound(format!("auth entry '{}' not found", id)))?;
        Ok(totp::totp_remaining_seconds(
            entry.period.max(1),
            entry.time_offset,
        ))
    }
}

// Helpers
fn base64_decode(s: &str) -> Result<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| SteamError::Crypto(format!("base64 decode: {}", e)))
}

fn uuid_v4() -> String {
    let mut bytes = [0u8; 16];
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    for (i, byte) in bytes.iter_mut().enumerate() {
        *byte = ((now >> (i * 8)) & 0xff) as u8;
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]),
        u16::from_be_bytes([bytes[8], bytes[9]]),
        u64::from_be_bytes([0, 0, 0, 0, bytes[10], bytes[11], bytes[12], bytes[13]]),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use std::env;
    use std::fs;

    #[test]
    fn test_auth_entry_lifecycle() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_auth_store.json");
        let _ = fs::remove_file(&path);

        {
            let mut mgr = AuthEntryManager::open(&path).unwrap();
            assert!(mgr.all_entries().is_empty());

            let entry = AuthEntry {
                id: "test-1".into(),
                issuer: "Steam".into(),
                account_name: "testuser".into(),
                token_type: TokenTypeSerde::Steam,
                algorithm: OtpAlgorithmSerde::Sha1,
                digits: 5,
                period: 30,
                counter: 0,
                time_offset: 0,
                secret_encrypted: b"test_secret_12345".to_vec(),
                created_at: chrono::Utc::now(),
                serial_number: None,
                device_id: None,
                is_active: true,
                identity_secret_encrypted: Vec::new(),
                steam_id: None,
                revocation_code: None,
            };
            mgr.add_entry(entry).unwrap();
        }

        {
            let mgr = AuthEntryManager::open(&path).unwrap();
            assert_eq!(mgr.all_entries().len(), 1);
            let entry = mgr.get_entry("test-1").unwrap();
            assert_eq!(entry.issuer, "Steam");

            // Should generate a 5-char Steam code
            let code = mgr.generate_code("test-1").unwrap();
            assert_eq!(code.len(), 5);
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn import_mafile_stores_identity_fields() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_mafile.json");
        let _ = fs::remove_file(&path);

        // shared_secret + identity_secret are the base64 of the byte string
        // "0123456789abcdef0123" (20 bytes) and "abcdef0123456789" (16 bytes).
        let shared = base64::engine::general_purpose::STANDARD.encode(b"0123456789abcdef0123");
        let identity = base64::engine::general_purpose::STANDARD.encode(b"abcdef0123456789");
        let ma_file = format!(
            r#"{{
                "account_name": "alice",
                "shared_secret": "{}",
                "identity_secret": "{}",
                "serial_number": "S123",
                "revocation_code": "R456",
                "device_id": "android:deadbeef",
                "steam_id": "76561198000000000"
            }}"#,
            shared, identity
        );

        {
            let mut mgr = AuthEntryManager::open(&path).unwrap();
            let entry = mgr.import_mafile(&ma_file).unwrap();
            assert_eq!(entry.issuer, "Steam");
            assert_eq!(entry.steam_id.as_deref(), Some("76561198000000000"));
            assert_eq!(entry.device_id.as_deref(), Some("android:deadbeef"));
            assert_eq!(entry.serial_number.as_deref(), Some("S123"));
            assert_eq!(entry.revocation_code.as_deref(), Some("R456"));
            assert_eq!(entry.identity_secret_encrypted, b"abcdef0123456789");
        }

        // Reload: identity secret round-trips through SecureStore.
        {
            let mgr = AuthEntryManager::open(&path).unwrap();
            let entry = mgr.all_entries().first().unwrap();
            assert_eq!(entry.identity_secret_encrypted, b"abcdef0123456789");
            assert_eq!(entry.secret_encrypted, b"0123456789abcdef0123");
            assert_eq!(entry.steam_id.as_deref(), Some("76561198000000000"));
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn import_mafile_without_identity_secret_still_works() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_mafile_min.json");
        let _ = fs::remove_file(&path);

        let shared = base64::engine::general_purpose::STANDARD.encode(b"0123456789abcdef0123");
        let ma_file = format!(
            r#"{{ "account_name": "bob", "shared_secret": "{}" }}"#,
            shared
        );

        let mut mgr = AuthEntryManager::open(&path).unwrap();
        let entry = mgr.import_mafile(&ma_file).unwrap();
        assert!(entry.identity_secret_encrypted.is_empty());
        assert_eq!(entry.steam_id, None);
        assert_eq!(entry.serial_number, None);

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn old_entry_json_without_new_fields_deserializes() {
        // Entries persisted before the identity_secret/steam_id fields were
        // added must still load (Option → None, skipped Vec → empty).
        let json = r#"{
            "id": "legacy-1",
            "issuer": "Steam",
            "account_name": "legacy",
            "token_type": "Steam",
            "algorithm": "Sha1",
            "digits": 5,
            "period": 30,
            "counter": 0,
            "time_offset": 0,
            "created_at": "2026-08-04T00:00:00Z",
            "serial_number": null,
            "device_id": null,
            "is_active": true
        }"#;
        let entry: AuthEntry = serde_json::from_str(json).unwrap();
        assert_eq!(entry.steam_id, None);
        assert_eq!(entry.revocation_code, None);
        assert!(entry.identity_secret_encrypted.is_empty());
        assert!(entry.secret_encrypted.is_empty());
    }
}
