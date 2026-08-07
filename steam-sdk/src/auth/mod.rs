//! Steam authentication module.
//!
//! Implements Steam Web API authentication flows:
//! - RSA public key acquisition
//! - Password-based login (BeginAuthSessionViaCredentials)
//! - QR code login
//! - Session polling with SteamGuard support
//! - Session persistence and management

pub mod login;
pub mod session;
pub mod token;
