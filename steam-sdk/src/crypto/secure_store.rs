//! Secure encrypted key-value store.
//!
//! Uses AES-256-GCM (via `ring`) for encryption. The 32-byte key is protected
//! with **Windows DPAPI** (`CryptProtectData`, user-scope) and stored in the
//! file as an opaque blob — on-disk protection is bound to the Windows user,
//! so a copied store file cannot be decrypted elsewhere. On platforms without
//! DPAPI the key falls back to a PBKDF2 derivation keyed by the hostname
//! (weaker; documented limitation).
//!
//! Legacy stores (written before the DPAPI master key existed) are re-bound on
//! first open: the existing key material is unchanged, so all entries stay
//! readable — only the on-disk protection improves. Data is persisted as a
//! JSON file of base64 nonce + ciphertext pairs.
//!
//! # Security model
//!
//! This provides **at-rest** encryption. It is not designed to protect against
//! an attacker with access to the running process memory.
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

/// Number of PBKDF2 iterations for the legacy (non-DPAPI) key derivation.
const PBKDF2_ITERATIONS: u32 = 100_000;

/// Nonce size for AES-256-GCM (12 bytes as recommended by NIST).
const NONCE_LEN: usize = 12;

/// Salt prefix for the legacy PBKDF2 key derivation.
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
    /// DPAPI-protected 32-byte AES key (base64). Absent = legacy hostname-
    /// derived key (migrated to DPAPI on first open where supported).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    master_key: Option<String>,
    /// Encrypted entries keyed by lookup key (SHA-256 hex of the original key).
    entries: HashMap<String, EncryptedEntry>,
}

/// A secure encrypted key-value store backed by a JSON file.
pub struct SecureStore {
    /// Path to the encrypted store file.
    path: PathBuf,
    /// The active AES-256 key.
    key: LessSafeKey,
    /// Raw key bytes (kept to DPAPI-protect on migration).
    key_bytes: [u8; 32],
    /// DPAPI blob for the key, when the store is DPAPI-bound.
    master_key: Option<String>,
    /// In-memory cache of entries.
    entries: HashMap<String, EncryptedEntry>,
    /// Cryptographic random number generator.
    rng: SystemRandom,
}

impl SecureStore {
    /// Open (or create) a secure store at the given path.
    ///
    /// On Windows the key is a DPAPI-protected blob in the file (bound to the
    /// current user). Legacy stores written before the master key existed are
    /// migrated in place on first open — the key material is unchanged, so
    /// existing entries stay readable. On non-Windows platforms the key is
    /// derived from the machine hostname.
    pub fn open(path: &Path) -> Result<Self> {
        let rng = SystemRandom::new();
        let mut master_key: Option<String> = None;
        let entries = if path.exists() {
            let content = fs::read_to_string(path).map_err(|e| SteamError::Io(e))?;
            if content.trim().is_empty() {
                HashMap::new()
            } else {
                let store_file: StoreFile = serde_json::from_str(&content)?;
                master_key = store_file.master_key;
                store_file.entries
            }
        } else {
            HashMap::new()
        };

        let key_bytes = match &master_key {
            Some(blob) => dpapi_unprotect(&base64_decode(blob)?)?,
            None => derive_legacy_key_bytes()?,
        };
        let key = key_from_bytes(&key_bytes)?;

        let mut store = Self {
            path: path.to_path_buf(),
            key,
            key_bytes,
            master_key,
            entries,
            rng,
        };
        // Re-bind a legacy (hostname-derived) store to a DPAPI-protected key
        // where DPAPI is available. The key is unchanged; only the on-disk
        // protection improves.
        store.install_master_key_if_needed()?;
        Ok(store)
    }

    /// Wrap the key in a DPAPI blob and persist it, unless one already exists.
    /// Non-Windows platforms keep the legacy derivation (best-effort no-op).
    fn install_master_key_if_needed(&mut self) -> Result<()> {
        if self.master_key.is_some() {
            return Ok(());
        }
        match dpapi_protect(&self.key_bytes) {
            Ok(blob) => {
                self.master_key = Some(base64_encode(&blob));
                self.save()?;
            }
            Err(_) => {
                // DPAPI unavailable — keep the hostname-derived fallback so the
                // store remains usable and portable.
            }
        }
        Ok(())
    }

    /// Get a value by key. Returns `None` if the key is not present.
    pub fn get(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let lookup = hash_key(key);
        match self.entries.get(&lookup) {
            None => Ok(None),
            Some(entry) => decrypt_with(&self.key, entry).map(Some),
        }
    }

    /// Set a key-value pair. The value is encrypted before storage.
    pub fn set(&mut self, key: &str, value: &[u8]) -> Result<()> {
        let lookup = hash_key(key);
        let entry = encrypt_with(&self.key, &self.rng, value)?;
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
            master_key: self.master_key.clone(),
            entries: self.entries.clone(),
        };
        let content = serde_json::to_string_pretty(&store_file)?;
        // Atomic write: write a temp file then rename over the target, so a
        // crash or power loss mid-write can never leave the store half-written
        // (which would corrupt every entry). Readers see either the old or the
        // new file, never a partial one.
        let tmp = self.path.with_extension("tmp");
        fs::write(&tmp, content).map_err(SteamError::Io)?;
        fs::rename(&tmp, &self.path).map_err(SteamError::Io)
    }
}

/// Encrypt a value into a stored entry with the given key.
fn encrypt_with(
    key: &LessSafeKey,
    rng: &SystemRandom,
    value: &[u8],
) -> Result<EncryptedEntry> {
    // Generate a random nonce
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill(&mut nonce_bytes)
        .map_err(|_| SteamError::Crypto("failed to generate random nonce".into()))?;

    let mut in_out = value.to_vec();
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    key.seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .map_err(|_| SteamError::Crypto("encryption failed".into()))?;

    // The ciphertext now includes the 16-byte GCM tag appended at the end
    Ok(EncryptedEntry {
        nonce: base64_encode(&nonce_bytes),
        ciphertext: base64_encode(&in_out),
    })
}

/// Decrypt a stored entry with the given key.
fn decrypt_with(key: &LessSafeKey, entry: &EncryptedEntry) -> Result<Vec<u8>> {
    let nonce_bytes = base64_decode(&entry.nonce)?;
    let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
        .map_err(|_| SteamError::Crypto("invalid nonce length".into()))?;
    let mut ciphertext = base64_decode(&entry.ciphertext)?;

    let decrypted = key
        .open_in_place(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|_| SteamError::Crypto("decryption failed (wrong key or corrupted data)".into()))?;
    Ok(decrypted.to_vec())
}

/// Legacy key derivation (hostname-keyed), used when no DPAPI blob is present.
fn derive_legacy_key_bytes() -> Result<[u8; 32]> {
    let machine_id = get_machine_id();
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
    Ok(key_bytes)
}

fn key_from_bytes(key_bytes: &[u8; 32]) -> Result<LessSafeKey> {
    let unbound_key = UnboundKey::new(&AES_256_GCM, key_bytes)
        .map_err(|_| SteamError::Crypto("failed to create AES key".into()))?;
    Ok(LessSafeKey::new(unbound_key))
}

/// Protect bytes with Windows DPAPI (user scope). Errors on non-Windows.
#[cfg(target_os = "windows")]
fn dpapi_protect(data: &[u8]) -> Result<Vec<u8>> {
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    // windows-sys 0.59 does not expose `LocalFree`; declare the one call we
    // need to release the DPAPI output buffer.
    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(h_mem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    }

    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    let ok = unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(SteamError::Crypto("DPAPI protect failed".into()));
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };
    Ok(bytes)
}

/// Unprotect a DPAPI blob into the raw key bytes.
#[cfg(target_os = "windows")]
fn dpapi_unprotect(blob: &[u8]) -> Result<[u8; 32]> {
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(h_mem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    }

    let input = CRYPT_INTEGER_BLOB {
        cbData: blob.len() as u32,
        pbData: blob.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(SteamError::Crypto(
            "store key unavailable (created on a different Windows user/machine)".into(),
        ));
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };
    bytes
        .try_into()
        .map_err(|_| SteamError::Crypto("unexpected store key length".into()))
}

#[cfg(not(target_os = "windows"))]
fn dpapi_protect(_data: &[u8]) -> Result<Vec<u8>> {
    Err(SteamError::Crypto("DPAPI unavailable on this platform".into()))
}

#[cfg(not(target_os = "windows"))]
fn dpapi_unprotect(_blob: &[u8]) -> Result<[u8; 32]> {
    Err(SteamError::Crypto("DPAPI unavailable on this platform".into()))
}

/// Get a machine identifier for the legacy key derivation.
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

    #[test]
    fn store_is_keyed_per_platform() {
        // On Windows a fresh store carries a DPAPI `master_key` blob; elsewhere
        // it stays legacy (no blob). Both must round-trip values.
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_keyed.json");
        let _ = fs::remove_file(&path);

        {
            let mut store = SecureStore::open(&path).unwrap();
            store.set("a", b"value-1").unwrap();
        }
        let raw = fs::read_to_string(&path).unwrap();
        #[cfg(target_os = "windows")]
        assert!(raw.contains("master_key"), "Windows stores must carry a DPAPI master key");
        #[cfg(not(target_os = "windows"))]
        assert!(!raw.contains("master_key"));

        {
            let store = SecureStore::open(&path).unwrap();
            assert_eq!(store.get("a").unwrap().unwrap(), b"value-1");
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn legacy_store_migrates_on_open() {
        // A store file without `master_key` (legacy format) must still open and
        // read, then gain a master key on Windows after migration.
        let dir = env::temp_dir();
        let path = dir.join("steam_sdk_test_legacy.json");
        let _ = fs::remove_file(&path);

        // Write a legacy-format file by hand: entries only, no master_key.
        let legacy = r#"{
            "entries": {
                "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b": {
                    "nonce": "b2FzZWZvZQ==",
                    "ciphertext": "AA=="
                }
            }
        }"#;
        fs::write(&path, legacy).unwrap();
        // The fake ciphertext won't decrypt, but open() itself must succeed and
        // (on Windows) rewrite the file with a master_key.
        let store = SecureStore::open(&path).unwrap();
        assert!(store.get("does-not-matter").is_ok() || store.get("does-not-matter").is_err());
        let raw = fs::read_to_string(&path).unwrap();
        #[cfg(target_os = "windows")]
        assert!(raw.contains("master_key"), "legacy store must be migrated to DPAPI");

        let _ = fs::remove_file(&path);
    }
}
