//! Transport-neutral consumer command envelopes.

use acp_core::ProviderSnapshot;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One consumer command envelope accepted by `service-runtime`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConsumerCommand {
    /// Caller-owned request id echoed in the response.
    pub id: String,
    /// ACP command name or Conduit-owned provider command.
    pub command: String,
    /// Provider identifier as supplied by the transport layer.
    pub provider: String,
    /// Command parameters.
    pub params: Value,
}

/// One stable consumer response envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConsumerResponse {
    /// Caller-owned request id echoed from the command.
    pub id: String,
    /// Whether the command completed successfully.
    pub ok: bool,
    /// ACP result payload or Conduit-owned command result.
    pub result: Value,
    /// Stable error payload when `ok` is false.
    pub error: Option<ConsumerError>,
    /// Read-side snapshot after command handling when available.
    pub snapshot: Option<ProviderSnapshot>,
}

impl ConsumerResponse {
    pub(crate) fn success(id: String, result: Value, snapshot: ProviderSnapshot) -> Self {
        Self {
            id,
            ok: true,
            result,
            error: None,
            snapshot: Some(snapshot),
        }
    }

    pub(crate) fn failure(id: String, code: &'static str, message: String) -> Self {
        Self {
            id,
            ok: false,
            result: Value::Null,
            error: Some(ConsumerError {
                code: code.to_owned(),
                message,
            }),
            snapshot: None,
        }
    }
}

/// Stable consumer error envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsumerError {
    /// Stable machine-readable error code.
    pub code: String,
    /// Human-readable error details.
    pub message: String,
}
