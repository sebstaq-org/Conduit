//! Errors for official ACP discovery and probing.

use std::path::PathBuf;
use std::sync::mpsc::RecvTimeoutError;
use thiserror::Error;

/// Result type for ACP discovery operations.
pub type Result<T> = std::result::Result<T, DiscoveryError>;

/// Errors produced while resolving or probing official ACP launchers.
#[derive(Debug, Error)]
pub enum DiscoveryError {
    /// A required executable was not found on `PATH`.
    #[error("could not resolve {program} on PATH")]
    ExecutableNotFound {
        /// The program name that could not be resolved.
        program: String,
    },
    /// A required managed executable was not built in any repo-owned location.
    #[error("could not resolve managed {program}; run `pnpm run codex-acp:build`")]
    ManagedExecutableNotFound {
        /// The program name that could not be resolved.
        program: String,
        /// Repo-owned candidate paths that were checked.
        candidates: Vec<PathBuf>,
    },
    /// Canonicalizing a resolved executable path failed.
    #[error("failed to canonicalize {path}")]
    CanonicalizePath {
        /// The resolved executable path.
        path: PathBuf,
        /// The underlying canonicalization error.
        #[source]
        source: std::io::Error,
    },
    /// Spawning a provider launcher failed.
    #[error("failed to spawn {program}")]
    Spawn {
        /// The provider launcher program.
        program: String,
        /// The underlying spawn error.
        #[source]
        source: std::io::Error,
    },
    /// Writing to a provider stdin failed.
    #[error("failed to write initialize request to {program}")]
    StdinWrite {
        /// The provider launcher program.
        program: String,
        /// The underlying write error.
        #[source]
        source: std::io::Error,
    },
    /// The provider did not answer `initialize` in time.
    #[error("{provider} did not answer initialize within {timeout_ms} ms")]
    InitializeTimeout {
        /// The provider identifier.
        provider: String,
        /// The timeout threshold in milliseconds.
        timeout_ms: u64,
        /// The underlying receive failure.
        #[source]
        source: RecvTimeoutError,
    },
    /// The provider emitted invalid JSON.
    #[error("failed to parse ACP message from {provider}")]
    Json {
        /// The provider identifier.
        provider: String,
        /// The raw line that failed to parse.
        line: String,
        /// The parse error.
        #[source]
        source: serde_json::Error,
    },
    /// The provider emitted an invalid ACP contract envelope.
    #[error("invalid ACP contract from {provider}: {message}")]
    Contract {
        /// The provider identifier.
        provider: String,
        /// The contract error string.
        message: String,
    },
    /// The provider returned an unexpected initialize payload.
    #[error("unexpected initialize response from {provider}: {message}")]
    InitializeResponse {
        /// The provider identifier.
        provider: String,
        /// The mismatch description.
        message: String,
    },
    /// A background reader thread terminated unexpectedly.
    #[error("provider stream for {provider} closed before initialize completed")]
    StreamClosed {
        /// The provider identifier.
        provider: String,
    },
    /// Reading a package metadata file failed.
    #[error("failed to read {path}")]
    MetadataRead {
        /// The metadata file path.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },
}
