//! Errors for the product service binary.

use thiserror::Error;

/// Result type for `service-bin`.
pub(crate) type Result<T> = std::result::Result<T, ServiceError>;

/// Errors raised by the product service CLI.
#[derive(Debug, Error)]
pub(crate) enum ServiceError {
    /// JSON serialization failed.
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    /// Official ACP provider discovery failed.
    #[error(transparent)]
    AcpDiscovery(#[from] acp_discovery::DiscoveryError),
    /// Telemetry initialization failed.
    #[error(transparent)]
    Telemetry(#[from] telemetry_support::TelemetryInitError),
    /// Local store operations failed.
    #[error(transparent)]
    LocalStore(#[from] session_store::Error),
    /// The operating system did not provide an application data directory.
    #[error("local store data directory is unavailable")]
    LocalStoreDataDirectory,
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
}
