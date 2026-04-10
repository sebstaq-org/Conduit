//! Shared helper functions for ACP host internals.

use crate::error::{AcpError, Result};
use crate::snapshot::LiveSessionIdentity;
use acp_discovery::ProviderId;
use agent_client_protocol_schema::{PromptResponse, RequestId, SessionId};
use serde::de::DeserializeOwned;
use serde_json::Value;

pub(super) fn decode_result<T>(response: Value, provider: ProviderId) -> Result<T>
where
    T: DeserializeOwned,
{
    if let Some(error) = response.get("error") {
        return Err(unexpected(
            provider,
            format!("provider returned error response: {error}"),
        ));
    }
    let result = response
        .get("result")
        .cloned()
        .ok_or_else(|| unexpected(provider, "response was missing result".to_owned()))?;
    serde_json::from_value(result).map_err(|error| unexpected(provider, error.to_string()))
}

pub(super) fn identity(provider: ProviderId, session_id: &SessionId) -> LiveSessionIdentity {
    LiveSessionIdentity {
        provider,
        acp_session_id: session_id.to_string(),
    }
}

pub(super) fn is_session_update(value: &Value) -> bool {
    value.get("method").and_then(Value::as_str) == Some("session/update")
}

pub(super) fn request_method(value: &Value) -> Option<String> {
    if value.get("id").is_some() {
        return value
            .get("method")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
    }
    None
}

pub(super) fn request_id_string(value: &Value) -> String {
    value.get("id").map_or_else(
        || "null".to_owned(),
        |id| match id {
            Value::String(value) => value.clone(),
            Value::Number(value) => value.to_string(),
            _ => id.to_string(),
        },
    )
}

pub(super) fn response_matches(value: &Value, request_id: &RequestId) -> bool {
    value.get("id").map(request_id_string_from_value) == Some(request_id.to_string())
        && (value.get("result").is_some() || value.get("error").is_some())
}

fn request_id_string_from_value(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Null => "null".to_owned(),
        _ => value.to_string(),
    }
}

pub(super) fn stop_reason_string(response: &PromptResponse) -> Option<String> {
    serde_json::to_value(response.stop_reason)
        .ok()
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
}

pub(super) fn unexpected(provider: ProviderId, message: String) -> AcpError {
    AcpError::UnexpectedEnvelope { provider, message }
}
