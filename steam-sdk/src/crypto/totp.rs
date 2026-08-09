//! TOTP / HOTP algorithm implementations.
//!
//! Supports standard TOTP (RFC 6238), HOTP (RFC 4226), and Steam's
//! custom TOTP variant using a 25-character alphabet.

use ring::hmac;

/// Steam's TOTP character set (excludes ambiguous characters: 0/O, 1/I/L/A/E/S/U/Z).
pub const STEAM_CHARS: &[char] = &[
    '2', '3', '4', '5', '6', '7', '8', '9', 'B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P',
    'Q', 'R', 'T', 'V', 'W', 'X', 'Y',
];

/// Hash algorithm for HMAC-based OTP.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OtpAlgorithm {
    Sha1,
    Sha256,
    Sha512,
}

/// Token type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TokenType {
    /// Standard TOTP (time-based, RFC 6238).
    Totp,
    /// HOTP (counter-based, RFC 4226).
    Hotp,
    /// Steam's custom TOTP variant.
    Steam,
}

// ── Core algorithm ──────────────────────────────────────────

/// Compute an HMAC-based one-time password.
///
/// This is the shared core of both HOTP and TOTP. Returns a 31-bit integer
/// extracted from the HMAC result (the "dynamic truncation" from RFC 4226).
fn compute_hotp_value(secret: &[u8], counter: u64, algorithm: OtpAlgorithm) -> Result<u32, String> {
    // Convert counter to big-endian bytes
    let counter_bytes = counter.to_be_bytes();

    // Compute HMAC
    let key = hmac::Key::new(algorithm_to_hmac(algorithm), secret);
    let tag = hmac::sign(&key, &counter_bytes);

    // Dynamic truncation (RFC 4226 §5.4)
    let offset = (tag.as_ref().last().copied().unwrap_or(0) & 0x0f) as usize;
    if offset + 4 > tag.as_ref().len() {
        return Err("HMAC tag too short for dynamic truncation".into());
    }

    let bytes: [u8; 4] = tag.as_ref()[offset..offset + 4]
        .try_into()
        .map_err(|_| "failed to extract code bytes")?;

    let fullcode = u32::from_be_bytes(bytes) & 0x7fff_ffff;

    Ok(fullcode)
}

// ── Public API ──────────────────────────────────────────────

/// Generate a standard decimal TOTP code.
///
/// # Arguments
/// * `secret` — Shared secret bytes
/// * `time_step` — Time step in seconds (usually 30)
/// * `digits` — Number of decimal digits (usually 6 or 8)
/// * `algorithm` — Hash algorithm (usually SHA1)
/// * `time_offset` — Time offset in seconds (for server time correction)
pub fn generate_totp(
    secret: &[u8],
    time_step: u64,
    digits: u8,
    algorithm: OtpAlgorithm,
    time_offset: i64,
) -> Result<String, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system time error: {}", e))?
        .as_secs() as i64;

    let adjusted = now + time_offset;
    let counter = (adjusted as u64) / time_step;

    generate_hotp(secret, counter, digits, algorithm)
}

/// Generate a standard decimal HOTP code.
///
/// # Arguments
/// * `secret` — Shared secret bytes
/// * `counter` — Counter value (incremented after each use)
/// * `digits` — Number of decimal digits (usually 6 or 8)
/// * `algorithm` — Hash algorithm (usually SHA1)
pub fn generate_hotp(
    secret: &[u8],
    counter: u64,
    digits: u8,
    algorithm: OtpAlgorithm,
) -> Result<String, String> {
    let fullcode = compute_hotp_value(secret, counter, algorithm)?;
    let divisor = 10u32.pow(digits as u32);
    let code = fullcode % divisor;
    Ok(format!("{:0width$}", code, width = digits as usize))
}

/// Generate a Steam-style TOTP code (5 alphanumeric characters).
///
/// Steam uses the same HMAC-based algorithm as standard TOTP but encodes
/// the result in a custom 25-character alphabet instead of decimal digits.
///
/// # Arguments
/// * `secret` — Shared secret bytes
/// * `time_offset` — Time offset in seconds (for server time correction)
pub fn generate_steam_totp(secret: &[u8], time_offset: i64) -> Result<String, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system time error: {}", e))?
        .as_secs() as i64;

    let adjusted = now + time_offset;
    let counter = (adjusted as u64) / 30; // Steam always uses 30-second steps

    let mut fullcode = compute_hotp_value(secret, counter, OtpAlgorithm::Sha1)?;

    // Convert to Steam's 5-character code
    let mut code = String::with_capacity(5);
    for _ in 0..5 {
        let idx = (fullcode % STEAM_CHARS.len() as u32) as usize;
        code.push(STEAM_CHARS[idx]);
        fullcode /= STEAM_CHARS.len() as u32;
    }

    Ok(code)
}

/// Get remaining seconds until the next TOTP interval.
pub fn totp_remaining_seconds(time_step: u64, time_offset: i64) -> u64 {
    let step = time_step.max(1) as i64;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0) as i64;

    // `rem_euclid` keeps the phase in [0, step) even when the adjusted time is
    // negative (large clock offset), so `step - elapsed` can't underflow.
    let elapsed = (now + time_offset).rem_euclid(step) as u64;
    (step as u64) - elapsed
}

// ── Secret encoding ─────────────────────────────────────────

/// Decode a Base32-encoded secret (common for TOTP URIs).
pub fn decode_base32_secret(encoded: &str) -> Result<Vec<u8>, String> {
    // Remove whitespace, make uppercase
    let cleaned: String = encoded
        .chars()
        .filter(|c| !c.is_whitespace())
        .map(|c| c.to_ascii_uppercase())
        .collect();

    base32_decode(&cleaned)
}

/// Simple RFC 4648 Base32 decoder (A-Z, 2-7, with = padding).
fn base32_decode(input: &str) -> Result<Vec<u8>, String> {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let input = input.trim_end_matches('=');

    let mut result = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits_left: u32 = 0;

    for ch in input.chars() {
        let val = ALPHABET
            .iter()
            .position(|&c| c == ch as u8)
            .ok_or_else(|| format!("invalid Base32 character: '{}'", ch))?;

        buffer = (buffer << 5) | val as u32;
        bits_left += 5;

        if bits_left >= 8 {
            bits_left -= 8;
            result.push((buffer >> bits_left) as u8);
            // Clear the byte we just extracted
            buffer &= (1 << bits_left) - 1;
        }
    }

    Ok(result)
}

// ── Helpers ─────────────────────────────────────────────────

fn algorithm_to_hmac(algorithm: OtpAlgorithm) -> hmac::Algorithm {
    match algorithm {
        OtpAlgorithm::Sha1 => hmac::HMAC_SHA1_FOR_LEGACY_USE_ONLY,
        OtpAlgorithm::Sha256 => hmac::HMAC_SHA256,
        OtpAlgorithm::Sha512 => hmac::HMAC_SHA512,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test vectors from RFC 4226 Appendix D
    const RFC_SECRET: &[u8] = b"12345678901234567890";

    #[test]
    fn test_hotp_rfc4226() {
        // RFC 4226 test vectors
        let expected: &[(u64, &str)] = &[
            (0, "755224"),
            (1, "287082"),
            (2, "359152"),
            (3, "969429"),
            (4, "338314"),
            (5, "254676"),
            (6, "287922"),
            (7, "162583"),
            (8, "399871"),
            (9, "520489"),
        ];

        for (counter, expected_code) in expected {
            let code = generate_hotp(RFC_SECRET, *counter, 6, OtpAlgorithm::Sha1).unwrap();
            assert_eq!(
                code, *expected_code,
                "HOTP({}) = {} (expected {})",
                counter, code, expected_code
            );
        }
    }

    #[test]
    fn test_base32_decode_rfc4648() {
        // RFC 4648 §10 test vectors
        assert_eq!(decode_base32_secret("MY======").unwrap(), b"f".to_vec());
        assert_eq!(decode_base32_secret("MZXQ====").unwrap(), b"fo".to_vec());
        assert_eq!(decode_base32_secret("MZXW6===").unwrap(), b"foo".to_vec());
        assert_eq!(decode_base32_secret("MZXW6YQ=").unwrap(), b"foob".to_vec());
        assert_eq!(decode_base32_secret("MZXW6YTB").unwrap(), b"fooba".to_vec());
        assert_eq!(
            decode_base32_secret("MZXW6YTBOI======").unwrap(),
            b"foobar".to_vec()
        );
    }

    #[test]
    fn test_base32_decode_lowercase() {
        let decoded = decode_base32_secret("mzxw6ytboi").unwrap();
        assert_eq!(String::from_utf8_lossy(&decoded), "foobar");
    }

    #[test]
    fn test_steam_totp_generation() {
        // With a known secret we should get 5 characters
        let secret = b"12345678901234567890";
        let code = generate_steam_totp(secret, 0).unwrap();
        assert_eq!(code.len(), 5);
        // All chars should be in STEAM_CHARS
        for ch in code.chars() {
            assert!(STEAM_CHARS.contains(&ch), "unexpected char: {}", ch);
        }
    }

    #[test]
    fn test_totp_deterministic() {
        let secret = b"test_secret_12345";
        let code1 = generate_totp(secret, 30, 6, OtpAlgorithm::Sha1, 0).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
        let code2 = generate_totp(secret, 30, 6, OtpAlgorithm::Sha1, 0).unwrap();
        // Within the same 30-second window, codes should be identical
        assert_eq!(code1, code2);
    }

    #[test]
    fn test_totp_remaining_seconds() {
        let remaining = totp_remaining_seconds(30, 0);
        assert!(remaining <= 30);
    }
}
