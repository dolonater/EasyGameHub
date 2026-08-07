//! Local Steam client operations.
//!
//! Platform-specific Steam client interactions: installation detection,
//! account switching via VDF/registry manipulation, and process management.

pub mod account_tools;
pub mod achievement_schema;
pub mod achievements_live_windows;
pub mod achievements_local;
pub mod cloud;
pub mod download;
pub mod steam_path;
pub mod steam_service;
pub mod switcher;
