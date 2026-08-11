//! Static currency → CNY conversion for multi-region price comparison.
//!
//! Approximate rates (mid-2026, per 1 CNY), deliberately a local constant —
//! no external FX API dependency. Used only to put prices from different
//! regions on a common scale for comparison; the raw regional price is always
//! shown alongside.

/// FX info for a currency.
#[derive(Debug)]
pub struct FxInfo {
    /// CNY value of one unit of this currency (approximate).
    pub per_cny: f64,
    /// Whether Steam reports this currency's `final`/`initial` fields in
    /// hundredths ("cents"). This is true for every currency — including
    /// JPY/KRW, whose *formatted* prices omit the decimals (¥1,117 is reported
    /// numerically as 111700).
    pub base_is_cents: bool,
}

/// Approximate mid-2026 rates per 1 CNY.
fn table() -> &'static [(&'static str, FxInfo)] {
    &[
        (
            "CNY",
            FxInfo {
                per_cny: 1.0,
                base_is_cents: true,
            },
        ),
        (
            "USD",
            FxInfo {
                per_cny: 7.20,
                base_is_cents: true,
            },
        ),
        (
            "EUR",
            FxInfo {
                per_cny: 7.80,
                base_is_cents: true,
            },
        ),
        (
            "GBP",
            FxInfo {
                per_cny: 9.10,
                base_is_cents: true,
            },
        ),
        (
            "JPY",
            FxInfo {
                per_cny: 0.048,
                base_is_cents: true,
            },
        ),
        (
            "KRW",
            FxInfo {
                per_cny: 0.0052,
                base_is_cents: true,
            },
        ),
        (
            "RUB",
            FxInfo {
                per_cny: 0.078,
                base_is_cents: true,
            },
        ),
        (
            "CAD",
            FxInfo {
                per_cny: 5.25,
                base_is_cents: true,
            },
        ),
        (
            "AUD",
            FxInfo {
                per_cny: 4.70,
                base_is_cents: true,
            },
        ),
        (
            "BRL",
            FxInfo {
                per_cny: 1.30,
                base_is_cents: true,
            },
        ),
        (
            "HKD",
            FxInfo {
                per_cny: 0.92,
                base_is_cents: true,
            },
        ),
        (
            "TWD",
            FxInfo {
                per_cny: 0.22,
                base_is_cents: true,
            },
        ),
        (
            "SGD",
            FxInfo {
                per_cny: 5.30,
                base_is_cents: true,
            },
        ),
        (
            "MXN",
            FxInfo {
                per_cny: 0.40,
                base_is_cents: true,
            },
        ),
        (
            "INR",
            FxInfo {
                per_cny: 0.086,
                base_is_cents: true,
            },
        ),
        (
            "TRY",
            FxInfo {
                per_cny: 0.21,
                base_is_cents: true,
            },
        ),
        (
            "PLN",
            FxInfo {
                per_cny: 1.83,
                base_is_cents: true,
            },
        ),
        (
            "NZD",
            FxInfo {
                per_cny: 4.30,
                base_is_cents: true,
            },
        ),
    ]
}

/// Look up FX info for a currency code; `None` for unknown currencies.
pub fn currency_info(currency: &str) -> Option<&'static FxInfo> {
    table()
        .iter()
        .find(|(code, _)| *code == currency)
        .map(|(_, info)| info)
}

/// Convert a Steam price amount (in the given currency's reported base unit)
/// to **CNY cents**, using the static table. Returns `None` for unknown
/// currencies or when the amount would overflow. The result is cents so it can
/// be fed straight into a cents-based formatter (`¥29.80` → `2980`), matching
/// the `cny_cents` DTO field.
pub fn to_cny(amount: u64, currency: &str) -> Option<u64> {
    let info = currency_info(currency)?;
    let units = if info.base_is_cents {
        amount as f64 / 100.0
    } else {
        amount as f64
    };
    let cny = (units * info.per_cny * 100.0).round();
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
        // USD 10.00 (1000 cents) × 7.20 → ¥72.00 → 7200 cents.
        assert_eq!(to_cny(1000, "USD"), Some(7200));
        // CNY 10.00 → ¥10.00 → 1000 cents.
        assert_eq!(to_cny(1000, "CNY"), Some(1000));
        // EUR 5.00 × 7.80 → ¥39.00 → 3900 cents.
        assert_eq!(to_cny(500, "EUR"), Some(3900));
    }

    #[test]
    fn jpy_krw_are_hundredths() {
        // JPY/KRW are reported in hundredths too (¥1,117 = 111700, even though
        // the formatted price omits decimals). The amounts below are arbitrary
        // *sample inputs* to verify the conversion formula — at runtime Steam's
        // per-game price is passed in, so any amount converts the same way.
        // ¥1,117.00 × 0.048 → ¥53.62 → 5362 cents.
        assert_eq!(to_cny(111700, "JPY"), Some(5362));
        // ₩6,960.00 × 0.0052 → ¥36.19 → 3619 cents.
        assert_eq!(to_cny(696000, "KRW"), Some(3619));
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
