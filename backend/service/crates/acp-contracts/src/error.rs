//! Error types for vendored ACP contract loading and validation.

use std::error::Error as StdError;
use std::fmt::{Display, Formatter};
use std::io;
use std::path::PathBuf;

/// The result type used by `acp-contracts`.
pub type Result<T> = std::result::Result<T, Error>;

/// Errors produced while loading or validating the vendored ACP bundle.
#[derive(Debug)]
pub enum Error {
    /// A filesystem operation failed.
    Io {
        /// The path associated with the failure.
        path: PathBuf,
        /// The source I/O error.
        source: io::Error,
    },
    /// A TOML document could not be parsed.
    Toml {
        /// The path associated with the failure.
        path: PathBuf,
        /// The source TOML error.
        source: toml::de::Error,
    },
    /// A JSON document could not be parsed.
    Json {
        /// The path associated with the failure.
        path: PathBuf,
        /// The source JSON error.
        source: serde_json::Error,
    },
    /// The vendored bundle is internally inconsistent.
    Contract(String),
    /// The pinned JSON Schema could not validate an envelope.
    Schema(Vec<String>),
}

impl Error {
    /// Creates a contract error.
    #[must_use]
    pub fn contract(message: impl Into<String>) -> Self {
        Self::Contract(message.into())
    }

    /// Creates a schema error from collected validation messages.
    #[must_use]
    pub fn schema(messages: Vec<String>) -> Self {
        Self::Schema(messages)
    }
}

impl Display for Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::Toml { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::Json { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::Contract(message) => write!(formatter, "{message}"),
            Self::Schema(messages) => write!(formatter, "{}", messages.join("\n")),
        }
    }
}

impl StdError for Error {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            Self::Toml { source, .. } => Some(source),
            Self::Json { source, .. } => Some(source),
            Self::Contract(_) | Self::Schema(_) => None,
        }
    }
}
