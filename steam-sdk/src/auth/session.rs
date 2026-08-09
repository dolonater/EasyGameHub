//! Steam session management.
//!
//! Manages Steam authentication sessions: loading from secure storage,
//! persisting access/refresh tokens, and auto-refreshing expired tokens.

use crate::crypto::secure_store::SecureStore;
use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A Steam authentication session containing tokens and user info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamSession {
    /// SteamID64 of the authenticated user.
    pub steam_id: u64,
    /// Account name used for login.
    pub account_name: String,
    /// Steam OAuth access token (short-lived, ~1 hour).
    pub access_token: String,
    /// Steam OAuth refresh token (long-lived).
    pub refresh_token: String,
    /// When the access token was obtained (UTC).
    pub obtained_at: chrono::DateTime<chrono::Utc>,
    /// Token expiry estimated duration in seconds (default 3600 = 1 hour).
    pub expires_in_seconds: u64,
    /// Whether this session is currently active.
    pub is_active: bool,
}

impl SteamSession {
    /// Check if the access token is expired or about to expire within
    /// the given grace period (default: 5 minutes).
    pub fn is_expired(&self) -> bool {
        // Clamp to 0: if the system clock moves backward after login the
        // duration is negative, and `num_seconds() as u64` would wrap to a huge
        // value that overflows the addition below.
        let elapsed = chrono::Utc::now()
            .signed_duration_since(self.obtained_at)
            .num_seconds()
            .max(0) as u64;
        let grace = 300; // 5 minutes
        elapsed + grace >= self.expires_in_seconds
    }
}

/// Manages multiple Steam sessions with secure persistent storage.
pub struct SessionManager {
    store: SecureStore,
    sessions: Vec<SteamSession>,
}

impl SessionManager {
    /// Open a session manager backed by the given secure store file.
    pub fn open(path: &Path) -> Result<Self> {
        let store = SecureStore::open(path)?;
        let sessions = Self::load_sessions(&store)?;
        Ok(Self { store, sessions })
    }

    /// Load all stored sessions from the secure store.
    fn load_sessions(store: &SecureStore) -> Result<Vec<SteamSession>> {
        let data = store.get("sessions")?;
        match data {
            Some(bytes) => {
                let sessions: Vec<SteamSession> = serde_json::from_slice(&bytes)?;
                Ok(sessions)
            }
            None => Ok(Vec::new()),
        }
    }

    /// Persist all sessions to the secure store.
    fn save_sessions(&mut self) -> Result<()> {
        let bytes = serde_json::to_vec(&self.sessions)?;
        self.store.set("sessions", &bytes)
    }

    /// Add or update a session. If a session with the same steam_id exists,
    /// it is replaced. Logging in is an explicit switch to this account, so it
    /// becomes the *only* active session — every other stored session is
    /// deactivated, otherwise `active_session()` would keep returning the
    /// oldest active entry after a second account logs in.
    pub fn upsert_session(&mut self, session: SteamSession) -> Result<()> {
        for existing in &mut self.sessions {
            existing.is_active = false;
        }

        self.sessions.retain(|s| s.steam_id != session.steam_id);
        self.sessions.push(session);
        self.save_sessions()
    }

    /// Get the active session, if any.
    pub fn active_session(&self) -> Option<&SteamSession> {
        self.sessions.iter().find(|s| s.is_active)
    }

    /// Get a session by SteamID64.
    #[allow(dead_code)]
    pub fn get_session(&self, steam_id: u64) -> Option<&SteamSession> {
        self.sessions.iter().find(|s| s.steam_id == steam_id)
    }

    /// Get all stored sessions.
    #[allow(dead_code)]
    pub fn all_sessions(&self) -> &[SteamSession] {
        &self.sessions
    }

    /// Remove a session by SteamID64.
    #[allow(dead_code)]
    pub fn remove_session(&mut self, steam_id: u64) -> Result<()> {
        self.sessions.retain(|s| s.steam_id != steam_id);
        self.save_sessions()
    }

    /// Set a session as active, deactivating others.
    pub fn set_active(&mut self, steam_id: u64) -> Result<()> {
        for session in &mut self.sessions {
            session.is_active = session.steam_id == steam_id;
        }
        self.save_sessions()
    }

    /// Get the number of stored sessions.
    #[allow(dead_code)]
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn test_path(name: &str) -> std::path::PathBuf {
        let dir = env::temp_dir();
        dir.join(format!("steam_sdk_test_session_{}.json", name))
    }

    #[test]
    fn test_session_manager_lifecycle() {
        let path = test_path("lifecycle");
        let _ = fs::remove_file(&path);

        {
            let mut mgr = SessionManager::open(&path).unwrap();
            assert_eq!(mgr.session_count(), 0);
            assert!(mgr.active_session().is_none());

            let session = SteamSession {
                steam_id: 76561199091385455,
                account_name: "testuser".into(),
                access_token: "access_123".into(),
                refresh_token: "refresh_456".into(),
                obtained_at: chrono::Utc::now(),
                expires_in_seconds: 3600,
                is_active: true,
            };
            mgr.upsert_session(session).unwrap();
            assert_eq!(mgr.session_count(), 1);
            assert!(mgr.active_session().is_some());
        }

        // Reopen and verify persistence
        {
            let mgr = SessionManager::open(&path).unwrap();
            assert_eq!(mgr.session_count(), 1);
            let session = mgr.active_session().unwrap();
            assert_eq!(session.account_name, "testuser");
            assert_eq!(session.access_token, "access_123");
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_session_expiry() {
        let session = SteamSession {
            steam_id: 123,
            account_name: "test".into(),
            access_token: "tok".into(),
            refresh_token: "ref".into(),
            obtained_at: chrono::Utc::now() - chrono::Duration::hours(2),
            expires_in_seconds: 3600,
            is_active: true,
        };
        assert!(session.is_expired());
    }

    #[test]
    fn test_multiple_sessions() {
        let path = test_path("multi");
        let _ = fs::remove_file(&path);

        {
            let mut mgr = SessionManager::open(&path).unwrap();
            mgr.upsert_session(SteamSession {
                steam_id: 111,
                account_name: "user1".into(),
                access_token: "tok1".into(),
                refresh_token: "ref1".into(),
                obtained_at: chrono::Utc::now(),
                expires_in_seconds: 3600,
                is_active: true,
            })
            .unwrap();
            mgr.upsert_session(SteamSession {
                steam_id: 222,
                account_name: "user2".into(),
                access_token: "tok2".into(),
                refresh_token: "ref2".into(),
                obtained_at: chrono::Utc::now(),
                expires_in_seconds: 3600,
                is_active: false,
            })
            .unwrap();
            assert_eq!(mgr.session_count(), 2);

            mgr.set_active(222).unwrap();
            assert_eq!(mgr.active_session().unwrap().steam_id, 222);
        }

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_second_login_deactivates_previous() {
        // Logging into a new account without logging out must make the new one
        // the single active session — otherwise `active_session()` would keep
        // returning the older account and chat/confirmations would use it.
        let path = test_path("second_login");
        let _ = fs::remove_file(&path);

        {
            let mut mgr = SessionManager::open(&path).unwrap();
            mgr.upsert_session(SteamSession {
                steam_id: 111,
                account_name: "user1".into(),
                access_token: "tok1".into(),
                refresh_token: "ref1".into(),
                obtained_at: chrono::Utc::now(),
                expires_in_seconds: 3600,
                is_active: true,
            })
            .unwrap();
            mgr.upsert_session(SteamSession {
                steam_id: 222,
                account_name: "user2".into(),
                access_token: "tok2".into(),
                refresh_token: "ref2".into(),
                obtained_at: chrono::Utc::now(),
                expires_in_seconds: 3600,
                is_active: true,
            })
            .unwrap();

            assert_eq!(mgr.session_count(), 2);
            let active = mgr.active_session().unwrap();
            assert_eq!(active.steam_id, 222, "second login must become active");
            assert_eq!(active.account_name, "user2");
        }

        let _ = fs::remove_file(&path);
    }
}
