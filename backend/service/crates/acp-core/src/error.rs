//! Errors for ACP host ownership.

use acp_discovery::{DiscoveryError, ProviderId};
use std::time::Duration;
use thiserror::Error;

/// Result type for ACP host operations.
pub type Result<T> = std::result::Result<T, AcpError>;

/// Errors produced by the Conduit ACP host boundary.
#[derive(Debug, Error)]
pub enum AcpError {
    /// Provider discovery failed.
    #[error(transparent)]
    Discovery(#[from] DiscoveryError),
    /// Contract loading or validation failed.
    #[error(transparent)]
    Contract(#[from] acp_contracts::Error),
    /// Spawning the provider process failed.
    #[error("failed to spawn {provider} transport")]
    Spawn {
        /// The provider being started.
        provider: ProviderId,
        /// The underlying process error.
        #[source]
        source: std::io::Error,
    },
    /// Provider stdin could not be written.
    #[error("failed to write {operation} to {provider}")]
    StdinWrite {
        /// The provider being written to.
        provider: ProviderId,
        /// The logical operation being sent.
        operation: String,
        /// The underlying write error.
        #[source]
        source: std::io::Error,
    },
    /// The provider returned invalid JSON.
    #[error("failed to parse JSON from {provider}")]
    Json {
        /// The provider that emitted invalid JSON.
        provider: ProviderId,
        /// The raw JSON line that failed.
        line: String,
        /// The parse error.
        #[source]
        source: serde_json::Error,
    },
    /// A request timed out.
    #[error("{operation} timed out for {provider} after {timeout:?}")]
    Timeout {
        /// The provider that timed out.
        provider: ProviderId,
        /// The logical operation name.
        operation: String,
        /// The timeout threshold.
        timeout: Duration,
    },
    /// The transport stream closed unexpectedly.
    #[error("{stream} stream closed for {provider} while waiting for {operation}")]
    StreamClosed {
        /// The provider whose stream closed.
        provider: ProviderId,
        /// The stream label.
        stream: String,
        /// The blocked operation.
        operation: String,
    },
    /// The provider returned an unexpected envelope.
    #[error("unexpected ACP envelope from {provider}: {message}")]
    UnexpectedEnvelope {
        /// The provider whose message was unexpected.
        provider: ProviderId,
        /// The mismatch details.
        message: String,
    },
    /// The host received an unsupported agent request.
    #[error("unsupported inbound request from {provider}: {method}")]
    UnsupportedAgentRequest {
        /// The provider that issued the request.
        provider: ProviderId,
        /// The agent request method name.
        method: String,
    },
    /// A session identity was required but missing.
    #[error("unknown session {session_id} for {provider}")]
    UnknownSession {
        /// The provider whose session lookup failed.
        provider: ProviderId,
        /// The ACP session id that was missing.
        session_id: String,
    },
}
