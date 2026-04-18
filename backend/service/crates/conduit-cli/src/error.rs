//! Error type for the Conduit operator CLI.

use std::error::Error as StdError;
use std::fmt::{Display, Formatter};
use std::io;
use std::path::PathBuf;

/// Result type for the Conduit operator CLI.
pub(crate) type Result<T> = std::result::Result<T, CliError>;

/// Errors raised by the Conduit operator CLI.
pub(crate) enum CliError {
    /// ACP provider operations failed.
    Acp(acp_core::AcpError),
    /// Capture output is invalid or unsupported.
    InvalidCapture(String),
    /// CLI arguments are invalid.
    InvalidCommand(String),
    /// File or directory I/O failed.
    Io {
        /// The path that failed, when available.
        path: Option<PathBuf>,
        /// The underlying I/O error.
        source: io::Error,
    },
    /// JSON serialization failed.
    Json(serde_json::Error),
    /// Timestamp formatting failed.
    Time(time::error::Format),
}

impl std::fmt::Debug for CliError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        Display::fmt(self, formatter)
    }
}

impl CliError {
    /// Creates an invalid command error.
    pub(crate) fn invalid_command(message: impl Into<String>) -> Self {
        Self::InvalidCommand(message.into())
    }

    /// Creates an invalid capture error.
    pub(crate) fn invalid_capture(message: impl Into<String>) -> Self {
        Self::InvalidCapture(message.into())
    }

    /// Creates an I/O error tied to a path.
    pub(crate) fn io(path: Option<PathBuf>, source: io::Error) -> Self {
        Self::Io { path, source }
    }
}

impl Display for CliError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Acp(source) => write!(formatter, "{source}"),
            Self::InvalidCapture(message) | Self::InvalidCommand(message) => {
                write!(formatter, "{message}")
            }
            Self::Io { path, source } => match path {
                Some(path) => write!(formatter, "{}: {source}", path.display()),
                None => write!(formatter, "{source}"),
            },
            Self::Json(source) => write!(formatter, "{source}"),
            Self::Time(source) => write!(formatter, "{source}"),
        }
    }
}

impl StdError for CliError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Self::Acp(source) => Some(source),
            Self::Io { source, .. } => Some(source),
            Self::Json(source) => Some(source),
            Self::Time(source) => Some(source),
            Self::InvalidCapture(_) | Self::InvalidCommand(_) => None,
        }
    }
}

impl From<acp_core::AcpError> for CliError {
    fn from(source: acp_core::AcpError) -> Self {
        Self::Acp(source)
    }
}

impl From<serde_json::Error> for CliError {
    fn from(source: serde_json::Error) -> Self {
        Self::Json(source)
    }
}

impl From<time::error::Format> for CliError {
    fn from(source: time::error::Format) -> Self {
        Self::Time(source)
    }
}

impl From<io::Error> for CliError {
    fn from(source: io::Error) -> Self {
        Self::Io { path: None, source }
    }
}
