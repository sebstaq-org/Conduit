//! Raw wire capture types for ACP transport ownership.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The stream that produced a captured wire event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WireStream {
    /// A message sent from Conduit to the provider.
    Outgoing,
    /// A message received from provider stdout.
    Incoming,
    /// A line received from provider stderr.
    Stderr,
}

/// The coarse JSON-RPC shape of a wire event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WireKind {
    /// JSON-RPC request.
    Request,
    /// JSON-RPC response.
    Response,
    /// JSON-RPC notification.
    Notification,
    /// Non-JSON stderr output.
    Diagnostic,
}

/// One raw line captured from the ACP transport.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct RawWireEvent {
    /// Monotonic sequence number within a single host connection.
    pub sequence: u64,
    /// The stream that produced the event.
    pub stream: WireStream,
    /// The coarse JSON-RPC shape.
    pub kind: WireKind,
    /// The raw line text exactly as captured.
    pub payload: String,
    /// The JSON-RPC method when present.
    pub method: Option<String>,
    /// The JSON-RPC request id when present.
    pub request_id: Option<String>,
    /// Parsed JSON when the line was valid JSON.
    pub json: Option<Value>,
}

impl RawWireEvent {
    /// Builds a diagnostic event from one stderr line.
    #[must_use]
    pub fn diagnostic(sequence: u64, payload: String) -> Self {
        Self {
            sequence,
            stream: WireStream::Stderr,
            kind: WireKind::Diagnostic,
            payload,
            method: None,
            request_id: None,
            json: None,
        }
    }

    /// Builds an outgoing or incoming JSON-RPC event from one envelope.
    #[must_use]
    pub fn rpc(sequence: u64, stream: WireStream, payload: String, json: Value) -> Self {
        let kind = classify_kind(&json);
        let method = json
            .get("method")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
        let request_id = json.get("id").map(request_id_string);

        Self {
            sequence,
            stream,
            kind,
            payload,
            method,
            request_id,
            json: Some(json),
        }
    }
}

fn classify_kind(json: &Value) -> WireKind {
    if json.get("method").is_some() && json.get("id").is_some() {
        return WireKind::Request;
    }
    if json.get("method").is_some() {
        return WireKind::Notification;
    }
    WireKind::Response
}

fn request_id_string(id: &Value) -> String {
    match id {
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Null => "null".to_owned(),
        _ => id.to_string(),
    }
}
