//! Steam price baseline and discount-drop detection (pure logic, testable).
//!
//! The baseline records the last price we saw for each app. A "drop" is a
//! strictly lower final price than that baseline, which the frontend turns
//! into a discount reminder. First-time checks never report a drop.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Last-seen price for a game, used to detect drops on subsequent checks.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceBaseline {
    pub final_price: u64,
    pub discount_pct: u32,
    pub checked_at: String,
    /// Store currency this baseline was recorded in (e.g. "CNY"). An empty
    /// value means an entry written before the field existed. A currency
    /// change (e.g. USD → CNY) resets the baseline so it can't fire a
    /// spurious price-drop event.
    #[serde(default)]
    pub currency: String,
}

pub fn load_price_baseline(path: &Path) -> HashMap<u32, PriceBaseline> {
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(map) = serde_json::from_str::<HashMap<u32, PriceBaseline>>(&content) {
                return map;
            }
        }
    }
    HashMap::new()
}

pub fn save_price_baseline(path: &Path, map: &HashMap<u32, PriceBaseline>) {
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = std::fs::write(path, json);
    }
}

/// Whether the new final price counts as a drop relative to the last baseline.
///
/// A discount-percentage change alone (without a lower final price) is not a
/// drop. With no baseline yet this always returns `false`. A baseline recorded
/// in a different store currency (or a legacy entry with an unknown currency)
/// is never compared — the baseline is only refreshed, never reported as a
/// drop, so a region switch (e.g. USD → CNY) can't fire a spurious event.
pub fn check_price_drop(
    prev: Option<&PriceBaseline>,
    new_final: u64,
    new_discount: u32,
    currency: &str,
) -> bool {
    match prev {
        Some(baseline) => {
            if baseline.currency.is_empty() || baseline.currency != currency {
                return false;
            }
            new_final < baseline.final_price
        }
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn baseline(final_price: u64) -> PriceBaseline {
        PriceBaseline {
            final_price,
            discount_pct: 0,
            checked_at: "2026-08-07 00:00:00".into(),
            currency: "CNY".into(),
        }
    }

    #[test]
    fn test_first_check_never_drops() {
        assert!(!check_price_drop(None, 1000, 0, "CNY"));
    }

    #[test]
    fn test_price_drop_detected() {
        assert!(check_price_drop(Some(&baseline(1500)), 1000, 33, "CNY"));
    }

    #[test]
    fn test_same_price_no_drop() {
        assert!(!check_price_drop(Some(&baseline(1000)), 1000, 50, "CNY"));
    }

    #[test]
    fn test_price_increase_no_drop() {
        assert!(!check_price_drop(Some(&baseline(1000)), 1200, 0, "CNY"));
    }

    #[test]
    fn test_discount_change_without_price_change_no_drop() {
        assert!(!check_price_drop(Some(&baseline(1000)), 1000, 60, "CNY"));
    }

    #[test]
    fn test_currency_change_resets_baseline() {
        // Switching store regions (e.g. USD → CNY) must never report a drop,
        // even when the raw cent values happen to be lower.
        assert!(!check_price_drop(Some(&baseline(1000)), 500, 0, "USD"));
    }

    #[test]
    fn test_legacy_baseline_without_currency_is_reset() {
        // Pre-currency entries load with an empty currency (serde default) and
        // are only refreshed, never compared.
        let mut legacy = baseline(1000);
        legacy.currency = String::new();
        assert!(!check_price_drop(Some(&legacy), 500, 0, "CNY"));
    }

    #[test]
    fn test_save_load_roundtrip() {
        let dir = std::env::temp_dir();
        let path = dir.join("doona_price_baseline_test.json");
        let _ = std::fs::remove_file(&path);

        let mut map = HashMap::new();
        map.insert(730u32, baseline(4980));
        save_price_baseline(&path, &map);
        let loaded = load_price_baseline(&path);
        assert_eq!(loaded.get(&730).unwrap().final_price, 4980);

        let _ = std::fs::remove_file(&path);
    }
}
