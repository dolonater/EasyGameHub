//! Steam SDK for Doona GameSave Backup
//!
//! Provides Steam authentication, inventory, achievements, cloud saves,
//! account switching, and local authenticator functionality.
//!
//! ## Architecture
//!
//! This crate is designed to be independent of Tauri — it provides pure
//! Rust logic that can be called from Tauri commands (or any other
//! consumer). All network calls are abstracted behind the [`client`]
//! module.

pub mod auth;
pub mod client;
pub mod crypto;
pub mod error;
pub mod local;
pub mod proto_gen;
pub mod vdf;

// Re-export commonly used types
pub use client::SteamHttpClient;
