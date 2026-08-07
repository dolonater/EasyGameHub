use thiserror::Error;

/// Steam SDK unified error type.
#[derive(Error, Debug)]
pub enum SteamError {
    /// VDF parse or write error.
    #[error("VDF error: {0}")]
    Vdf(#[from] VdfError),

    /// Protobuf decode error.
    #[error("Protobuf decode error: {0}")]
    Proto(#[from] prost::DecodeError),

    /// HTTP request error (string representation for now; will be
    /// replaced with reqwest::Error when reqwest is added).
    #[error("HTTP error: {0}")]
    Http(String),

    /// Authentication failed.
    #[error("Authentication failed: {0}")]
    Auth(String),

    /// Cryptographic operation failed.
    #[error("Crypto error: {0}")]
    Crypto(String),

    /// Resource not found.
    #[error("Not found: {0}")]
    NotFound(String),

    /// Steam API returned an error.
    #[error("Steam API error (code={code}): {message}")]
    ApiError {
        /// Steam error code.
        code: i32,
        /// Error message.
        message: String,
    },

    /// I/O error.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON serialization error.
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// General-purpose error.
    #[error("{0}")]
    General(String),
}

/// VDF-specific error.
#[derive(Error, Debug)]
pub enum VdfError {
    /// Failed to parse VDF content.
    #[error("Parse error at line {line}: {message}")]
    Parse {
        /// Line number where the error occurred.
        line: usize,
        /// Error description.
        message: String,
    },

    /// Expected a key but found something else.
    #[error("Expected key at line {line}")]
    ExpectedKey {
        /// Line number.
        line: usize,
    },

    /// Unmatched opening brace.
    #[error("Unmatched '{{' at line {line}")]
    UnmatchedBrace {
        /// Line number where the unmatched brace was found.
        line: usize,
    },

    /// I/O error during VDF read/write.
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

/// Convenience type alias for Result with SteamError.
pub type Result<T> = std::result::Result<T, SteamError>;
