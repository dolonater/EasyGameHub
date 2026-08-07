//! Steam price baseline, discount-drop detection and price history
//! (pure logic, testable).
//!
//! The baseline records the last price we saw for each app plus a bounded
//! history used for the "历史最低价" badge and the price sparkline. A "drop"
//! is a strictly lower final price than the last baseline, which the frontend
//! turns into a discount reminder. First-time checks never report a drop.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// A single recorded price observation for the history sparkline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricePoint {
    pub final_price: u64,
    pub discount_pct: u32,
    /// Local time "YYYY-MM-DD HH:MM:SS".
    pub date: String,
}

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
    /// Price history (newest last) for the sparkline. Skipped on checks that
    /// see the same price + discount, so a sale-end blip adds no noise.
    #[serde(default)]
    pub history: Vec<PricePoint>,
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
    _new_discount: u32,
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

/// Max history points kept per app (oldest dropped first).
const MAX_HISTORY_POINTS: usize = 200;

/// Build the next baseline from a fresh price observation, preserving the
/// price history. When the previous baseline is missing or recorded in a
/// different currency, history starts fresh (prices across currencies are not
/// comparable). A check that sees the same final price + discount as the last
/// recorded point adds no new point, so stable prices don't grow the file.
pub fn update_baseline(
    prev: Option<&PriceBaseline>,
    new_final: u64,
    new_discount: u32,
    currency: &str,
    checked_at: &str,
) -> PriceBaseline {
    let (mut history, comparable) = match prev {
        Some(b) if !b.currency.is_empty() && b.currency == currency => (b.history.clone(), true),
        _ => (Vec::new(), false),
    };

    let changed = history
        .last()
        .map(|p| p.final_price != new_final || p.discount_pct != new_discount)
        .unwrap_or(true);
    if !comparable || changed {
        history.push(PricePoint {
            final_price: new_final,
            discount_pct: new_discount,
            date: checked_at.into(),
        });
        if history.len() > MAX_HISTORY_POINTS {
            let excess = history.len() - MAX_HISTORY_POINTS;
            history.drain(0..excess);
        }
    }

    PriceBaseline {
        final_price: new_final,
        discount_pct: new_discount,
        checked_at: checked_at.into(),
        currency: currency.into(),
        history,
    }
}

/// Lowest price ever recorded for a game across its history, if any.
pub fn lowest_recorded(baseline: &PriceBaseline) -> Option<u64> {
    baseline.history.iter().map(|p| p.final_price).min()
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
            history: vec![PricePoint {
                final_price,
                discount_pct: 0,
                date: "2026-08-07 00:00:00".into(),
            }],
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
        assert_eq!(loaded.get(&730).unwrap().history.len(), 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_update_baseline_appends_history_on_change() {
        let prev = baseline(4980);
        let next = update_baseline(Some(&prev), 2980, 40, "CNY", "2026-08-08 10:00:00");
        assert_eq!(next.final_price, 2980);
        assert_eq!(next.history.len(), 2);
        assert_eq!(next.history[0].final_price, 4980);
        assert_eq!(next.history[1].final_price, 2980);
    }

    #[test]
    fn test_update_baseline_dedupes_unchanged_price() {
        let prev = baseline(4980);
        // Same price + discount → no new point.
        let next = update_baseline(Some(&prev), 4980, 0, "CNY", "2026-08-08 10:00:00");
        assert_eq!(next.history.len(), 1);
        // Same price but discount changed → record (sale blip worth seeing).
        let next = update_baseline(Some(&prev), 4980, 10, "CNY", "2026-08-08 10:00:00");
        assert_eq!(next.history.len(), 2);
    }

    #[test]
    fn test_update_baseline_resets_on_currency_change() {
        let prev = baseline(4980);
        let next = update_baseline(Some(&prev), 500, 0, "USD", "2026-08-08 10:00:00");
        assert_eq!(next.history.len(), 1);
        assert_eq!(next.history[0].final_price, 500);
    }

    #[test]
    fn test_update_baseline_caps_history_length() {
        let mut prev = baseline(1000);
        for i in 0..250u64 {
            prev = update_baseline(
                Some(&prev),
                1000 + i,
                (i % 100) as u32,
                "CNY",
                "2026-08-08 10:00:00",
            );
        }
        assert!(prev.history.len() <= 200);
    }

    #[test]
    fn test_lowest_recorded() {
        let mut b = baseline(5000);
        b = update_baseline(Some(&b), 3000, 40, "CNY", "2026-08-08 10:00:00");
        b = update_baseline(Some(&b), 4000, 20, "CNY", "2026-08-09 10:00:00");
        assert_eq!(lowest_recorded(&b), Some(3000));
        assert_eq!(lowest_recorded(&baseline(1000)), Some(1000));
    }
}
