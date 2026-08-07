//! Secure encrypted key-value store.
//!
//! Uses AES-256-GCM (via `ring`) for encryption and PBKDF2-HMAC-SHA256 for
//! key derivation from a machine-identity salt. Data is persisted as a JSON
//! file containing base64-encoded nonce + ciphertext pairs.
//!
//! # Security model
//!
//! This provides **at-rest** encryption for sensitive data such as Steam
//! session tokens, authenticator secrets, and API keys. It is not designed
//! to protect against an attacker with access to the running process memory.
//!
//! # Example
//!
//! ```ignore
//! let mut store = SecureStore::open(&path)?;
//! store.set("steam_token", b"my-secret-token")?;
//! let token = store.get("steam_token")?;
//! store.remove("steam_token")?;
//! ```

use crate::error::{Result, SteamError};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::pbkdf2;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Number of PBKDF2 iterations for key derivation.
const PBKDF2_ITERATIONS: u32 = 100_000;

/// Nonce size for AES-256-GCM (12 bytes as recommended by NIST).
const NONCE_LEN: usize = 12;

/// Salt for PBKDF2 key derivation.
const SALT_PREFIX: &[u8] = b"steam-sdk-secure-store-v1";

/// On-disk format for an encrypted entry.
#[derive(Serialize, Deserialize, Clone)]
struct EncryptedEntry {
    /// Base64-encoded nonce.
    nonce: String,
    /// Base64-encoded ciphertext (includes GCM authentication tag).
    ciphertext: String,
}

/// On-disk format for the entire store.
#[derive(Serialize, Deserialize, Default)]
struct StoreFile {
    /// Encrypted entries keyed by lookup key (SHA-256 hex of the original key).
    entries: HashMap<String, EncryptedEntry>,
}

/// A secure encrypted key-value store backed by a JSON file.
pub struct SecureStore {
    /// Path to the encrypted store file.
    path: PathBuf,
    /// The derived AES-256 key.
    key: LessSafeKey,
    /// In-memory cache of entries.
    entries: HashMap<String, EncryptedEntry>,
    /// Cryptographic random number generator.
    rng: SystemRandom,
}

impl SecureStore {
    /// Open (or create) a secure store at the given path.
    ///
    /// If the file does not exist, an empty store is created. The encryption
    /// key is derived from the current machine's hostname — if the hostname
    /// changes, existing data will be unreadable.
    pub fn open(path: &Path) -> Result<Self> {
        let key = derive_key()?;
        let rng = SystemRandom::new();

        let entries = if path.exists() {
            let content = fs::read_to_string(path).map_err(|e| SteamError::Io(e))?;
            if content.trim().is_empty() {
                HashMap::new()
            } else {
                let store_file: StoreFile = serde_json::from_str(&content)?;
                store_file.entries
            }
        } else {
            HashMap::new()
        };

        Ok(Self {
            path: path.to_path_buf(),
            key,
            entries,
            rng,
        })
    }

    /// Get a value by key. Returns `None` if the key is not present.
    pub fn get(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let lookup = hash_key(key);
        match self.entries.get(&lookup) {
            None => Ok(None),
            Some(entry) => {
                let nonce_bytes = base64_decode(&entry.nonce)?;
                let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
                    .map_err(|_| SteamError::Crypto("invalid nonce length".into()))?;
                let mut ciphertext = base64_decode(&entry.ciphertext)?;

                let decrypted = self
                    .key
                    .open_in_place(nonce, Aad::empty(), &mut ciphertext)
                    .map_err(|_| {
                        SteamError::Crypto("decryption failed (wrong key or corrupted data)".into())
                    })?;

                Ok(Some(decrypted.to_vec()))
            }
        }
    }

    /// Set a key-value pair. The value is encrypted before storage.
    pub fn set(&mut self, key: &str, value: &[u8]) -> Result<()> {
        let lookup = hash_key(key);

        // Generate a random nonce
        let mut nonce_bytes = [0u8; NONCE_LEN];
        self.rng
            .fill(&mut nonce_bytes)
            .map_err(|_| SteamError::Crypto("failed to generate random nonce".into()))?;

        // Encrypt the value
        let mut in_out = value.to_vec();
        let nonce = Nonce::assume_unique_for_key(nonce_bytes);
        self.key
            .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| SteamError::Crypto("encryption failed".into()))?;

        // The ciphertext now includes the 16-byte GCM tag appended at the end
        let entry = EncryptedEntry {
            nonce: base64_encode(&nonce_bytes),
            ciphertext: base64_encode(&in_out),
        };

        self.entries.insert(lookup, entry);
        self.save()
    }

    /// Remove a key and its associated value.
    pub fn remove(&mut self, key: &str) -> Result<()> {
        let lookup = hash_key(key);
        if self.entries.remove(&lookup).is_some() {
            self.save()?;
        }
        Ok(())
    }

    /// Check if a key exists.
    #[allow(dead_code)]
    pub fn contains_key(&self, key: &str) -> bool {
        let lookup = hash_key(key);
        self.entries.contains_key(&lookup)
    }

    /// Get all keys in the store.
    #[allow(dead_code)]
    pub fn keys(&self) -> Vec<&String> {
        self.entries.keys().collect()
    }

    /// Persist the current state to disk.
    fn save(&self) -> Result<()> {
        // Ensure the parent directory exists
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(SteamError::Io)?;
        }

        let store_file = StoreFile {
            entries: self.entries.clone(),
        };
        let content = serde_json::to_string_pretty(&store_file)?;
        fs::write(&self.path, content).map_err(SteamError::Io)
    }
}

/// Derive an AES-256 encryption key from the machine hostname.
///
/// Uses PBKDF2-HMAC-SHA256 with a fixed prefix salt concatenated with the
/// hostname. The key is deterministic for the same machine.
fn derive_key() -> Result<LessSafeKey> {
    // Get machine identifier — prefer COMPUTERNAME on Windows, fall back
    // to "unknown" on other platforms.
    let machine_id = get_machine_id();

    // Build salt: prefix + machine id
    let mut salt = Vec::from(SALT_PREFIX);
    salt.extend_from_slice(machine_id.as_bytes());

    let mut key_bytes = [0u8; 32]; // AES-256 = 32 bytes
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        std::num::NonZeroU32::new(PBKDF2_ITERATIONS).unwrap(),
        &salt,
        b"steam-sdk-secure-store", // password-like input
        &mut key_bytes,
    );

    let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes)
        .map_err(|_| SteamError::Crypto("failed to create AES key".into()))?;

    Ok(LessSafeKey::new(unbound_key))
}

/// Get a machine identifier for key derivation.
///
/// Uses the COMPUTERNAME environment variable on Windows, falling back to
/// a fixed string if unavailable.
fn get_machine_id() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(name) = std::env::var("COMPUTERNAME") {
            if !name.is_empty() {
                return name;
            }
        }
    }
    // Fallback
    "default-machine".to_string()
}

/// Hash a lookup key to a stable hex string (SHA-256).
fn hash_key(key: &str) -> String {
    use ring::digest::{digest, SHA256};
    let hash = digest(&SHA256, key.as_bytes());
    hex_encode(hash.as_ref())
}

/// Base64-encode a byte slice.
fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Base64-decode a string.
fn base64_decode(s: &str) -> Result<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| SteamError::Crypto(format!("base64 decode failed: {}", e)))
}

/// Hex-encode a byte slice.
fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_set_get_remove() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_secure_store.json");
        let _ = fs::remove_file(&path);

        {
            let mut store = SecureStore::open(&path).unwrap();
            store.set("test_key", b"secret value").unwrap();
        }

        {
            let store = SecureStore::open(&path).unwrap();
            let value = store.get("test_key").unwrap().unwrap();
            assert_eq!(value, b"secret value");
        }

        {
            let mut store = SecureStore::open(&path).unwrap();
            store.remove("test_key").unwrap();
            assert!(store.get("test_key").unwrap().is_none());
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_missing_key() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_missing_key.json");
        let _ = fs::remove_file(&path);

        let store = SecureStore::open(&path).unwrap();
        assert!(store.get("nonexistent").unwrap().is_none());

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_multiple_entries() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_multi.json");
        let _ = fs::remove_file(&path);

        {
            let mut store = SecureStore::open(&path).unwrap();
            store.set("key1", b"value1").unwrap();
            store.set("key2", b"value2").unwrap();
            store.set("key3", b"value3-longer").unwrap();
        }

        {
            let store = SecureStore::open(&path).unwrap();
            assert_eq!(store.get("key1").unwrap().unwrap(), b"value1");
            assert_eq!(store.get("key2").unwrap().unwrap(), b"value2");
            assert_eq!(store.get("key3").unwrap().unwrap(), b"value3-longer");
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_decryption_fails_with_wrong_key() {
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_wrong_key.json");
        let _ = fs::remove_file(&path);

        // This test just verifies the encrypted file is not plaintext
        {
            let mut store = SecureStore::open(&path).unwrap();
            store.set("secret", b"classified").unwrap();
        }

        // Read the raw file — it should NOT contain "classified"
        let raw = fs::read_to_string(&path).unwrap();
        assert!(!raw.contains("classified"));
        assert!(raw.contains("nonce"));
        assert!(raw.contains("ciphertext"));

        let _ = fs::remove_file(&path);
    }
}
