//! Static currency → CNY conversion for multi-region price comparison.
//!
//! Approximate rates (mid-2026, per 1 CNY), deliberately a local constant —
//! no external FX API dependency. Used only to put prices from different
//! regions on a common scale for comparison; the raw regional price is always
//! shown alongside.

/// FX info for a currency.
#[derive(Debug)]
pub struct FxInfo {
    /// Units of this currency per 1 CNY (approximate).
    pub per_cny: f64,
    /// Steam reports this currency in hundredths ("cents") vs whole units.
    /// JPY / KRW have no decimal places and are reported as whole units.
    pub base_is_cents: bool,
}

/// Approximate mid-2026 rates per 1 CNY.
fn table() -> &'static [(&'static str, FxInfo)] {
    &[
        ("CNY", FxInfo { per_cny: 1.0, base_is_cents: true }),
        ("USD", FxInfo { per_cny: 7.20, base_is_cents: true }),
        ("EUR", FxInfo { per_cny: 7.80, base_is_cents: true }),
        ("GBP", FxInfo { per_cny: 9.10, base_is_cents: true }),
        ("JPY", FxInfo { per_cny: 0.048, base_is_cents: false }),
        ("KRW", FxInfo { per_cny: 0.0052, base_is_cents: false }),
        ("RUB", FxInfo { per_cny: 0.078, base_is_cents: true }),
        ("CAD", FxInfo { per_cny: 5.25, base_is_cents: true }),
        ("AUD", FxInfo { per_cny: 4.70, base_is_cents: true }),
        ("BRL", FxInfo { per_cny: 1.30, base_is_cents: true }),
        ("HKD", FxInfo { per_cny: 0.92, base_is_cents: true }),
        ("TWD", FxInfo { per_cny: 0.22, base_is_cents: true }),
        ("SGD", FxInfo { per_cny: 5.30, base_is_cents: true }),
        ("MXN", FxInfo { per_cny: 0.40, base_is_cents: true }),
        ("INR", FxInfo { per_cny: 0.086, base_is_cents: true }),
        ("TRY", FxInfo { per_cny: 0.21, base_is_cents: true }),
        ("PLN", FxInfo { per_cny: 1.83, base_is_cents: true }),
        ("NZD", FxInfo { per_cny: 4.30, base_is_cents: true }),
    ]
}

/// Look up FX info for a currency code; `None` for unknown currencies.
pub fn currency_info(currency: &str) -> Option<&'static FxInfo> {
    table().iter().find(|(code, _)| *code == currency).map(|(_, info)| info)
}

/// Convert a Steam price amount (in the given currency's reported base unit)
/// to CNY cents, using the static table. Returns `None` for unknown currencies
/// or when the amount would overflow.
pub fn to_cny(amount: u64, currency: &str) -> Option<u64> {
    let info = currency_info(currency)?;
    let units = if info.base_is_cents {
        amount as f64 / 100.0
    } else {
        amount as f64
    };
    let cny = (units * info.per_cny).round();
    if cny.is_finite() && cny >= 0.0 && cny <= (u64::MAX as f64) {
        Some(cny as u64)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_known_currencies() {
        // USD 10.00 (1000 cents) × 7.20 → ¥72.00.
        assert_eq!(to_cny(1000, "USD"), Some(72));
        // CNY 10.00 → ¥10.00.
        assert_eq!(to_cny(1000, "CNY"), Some(10));
        // EUR 5.00 × 7.80 → ¥39.00.
        assert_eq!(to_cny(500, "EUR"), Some(39));
    }

    #[test]
    fn whole_unit_currencies() {
        // JPY is whole units (not cents): 1980 yen × 0.048 → ¥95.04 → 95.
        assert_eq!(to_cny(1980, "JPY"), Some(95));
        // KRW whole units: 5000 won × 0.0052 → ¥26.00.
        assert_eq!(to_cny(5000, "KRW"), Some(26));
    }

    #[test]
    fn unknown_currency_is_none() {
        assert_eq!(to_cny(100, "XXX"), None);
        assert!(currency_info("zzz").is_none());
    }

    #[test]
    fn zero_and_free_games() {
        assert_eq!(to_cny(0, "USD"), Some(0));
    }
}
