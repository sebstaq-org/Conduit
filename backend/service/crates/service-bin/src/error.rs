//! Errors for silent Phase 1 proof commands.

use std::path::PathBuf;
use thiserror::Error;

/// Result type for `service-bin`.
pub(crate) type Result<T> = std::result::Result<T, ServiceError>;

/// Errors raised by the proof CLI.
#[derive(Debug, Error)]
pub(crate) enum ServiceError {
    /// App API operations failed.
    #[error(transparent)]
    App(#[from] acp_core::AcpError),
    /// ACP contract operations failed.
    #[error(transparent)]
    Contract(#[from] acp_contracts::Error),
    /// Discovery operations failed.
    #[error(transparent)]
    Discovery(#[from] acp_discovery::DiscoveryError),
    /// JSON serialization failed.
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    /// Service I/O failed.
    #[error(transparent)]
    Io(#[from] std::io::Error),
    /// One required CLI flag was missing.
    #[error("missing required flag {flag}")]
    MissingFlag {
        /// The missing flag name.
        flag: String,
    },
    /// The CLI received an unsupported subcommand.
    #[error("unsupported command: {command}")]
    UnsupportedCommand {
        /// The unsupported command text.
        command: String,
    },
    /// The CLI received an invalid provider value.
    #[error("invalid provider {provider}: {message}")]
    InvalidProvider {
        /// The raw provider string.
        provider: String,
        /// The parse error details.
        message: String,
    },
    /// The CLI received an invalid flag value.
    #[error("invalid value for {flag}: {value} ({message})")]
    InvalidFlagValue {
        /// The flag name.
        flag: String,
        /// The raw flag value.
        value: String,
        /// The parse error details.
        message: String,
    },
    /// Preparing one proof or artifact directory failed.
    #[error("failed to prepare {path}")]
    PreparePath {
        /// The path being prepared.
        path: PathBuf,
        /// The underlying filesystem error.
        #[source]
        source: std::io::Error,
    },
    /// One proof artifact leaked state outside the isolated proof workspace.
    #[error("artifact isolation failed in {context}: {path}")]
    IsolationLeak {
        /// The logical proof context that leaked.
        context: String,
        /// The leaked absolute path.
        path: String,
    },
    /// A proof capture could not be finalized.
    #[error("{message}")]
    InvalidCapture {
        /// The invalid capture message.
        message: String,
    },
    /// Writing an artifact file failed.
    #[error("failed to write {path}")]
    WriteArtifact {
        /// The artifact path being written.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },
}
