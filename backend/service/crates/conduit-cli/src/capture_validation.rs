//! Provider capture validation and normalization.

use crate::cli::CaptureOperation;
use crate::error::{CliError, Result};
use serde_json::{Value, json};
use session_projection::TranscriptItemStatus;

pub(super) fn validate_capture(operation: &CaptureOperation, value: &Value) -> Result<()> {
    match operation {
        CaptureOperation::Initialize => validate_initialize(value),
        CaptureOperation::New => validate_session_new(value),
        CaptureOperation::List => validate_session_list(value),
        CaptureOperation::Load { .. } => validate_session_load(value),
        CaptureOperation::Prompt { .. } => validate_session_prompt(value),
        CaptureOperation::SetConfigOption { .. } => validate_session_set_config_option(value),
    }
}

pub(super) fn validate_initialize(value: &Value) -> Result<()> {
    if value.pointer("/request/method").and_then(Value::as_str) != Some("initialize") {
        return Err(CliError::invalid_capture(
            "provider initialize capture must contain request.method initialize",
        ));
    }
    if value.pointer("/request/protocolVersion").is_none() {
        return Err(CliError::invalid_capture(
            "provider initialize capture must contain request.protocolVersion",
        ));
    }
    if value.pointer("/response/protocolVersion").is_none() {
        return Err(CliError::invalid_capture(
            "provider initialize capture must contain response.protocolVersion",
        ));
    }
    if value
        .pointer("/response/agentCapabilities")
        .and_then(Value::as_object)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider initialize capture must contain response.agentCapabilities object",
        ));
    }
    if value
        .pointer("/response/authMethods")
        .and_then(Value::as_array)
        .is_some()
    {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider initialize capture must contain response.authMethods array",
    ))
}

pub(super) fn validate_session_new(value: &Value) -> Result<()> {
    if value.get("sessionId").and_then(Value::as_str).is_some() {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/new response must contain a sessionId string",
    ))
}

pub(super) fn validate_session_list(value: &Value) -> Result<()> {
    if value.get("sessions").and_then(Value::as_array).is_some() {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/list response must contain a sessions array",
    ))
}

pub(super) fn validate_session_load(value: &Value) -> Result<()> {
    if value.get("response").is_none() {
        return Err(CliError::invalid_capture(
            "provider session/load capture must contain a response field",
        ));
    }
    if value
        .pointer("/loadedTranscript/rawUpdateCount")
        .and_then(Value::as_u64)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/load capture must contain loadedTranscript.rawUpdateCount number",
        ));
    }
    if value
        .pointer("/loadedTranscript/updates")
        .and_then(Value::as_array)
        .is_some()
    {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/load capture must contain loadedTranscript.updates array",
    ))
}

pub(super) fn validate_session_prompt(value: &Value) -> Result<()> {
    if value
        .pointer("/promptRequest/sessionId")
        .and_then(Value::as_str)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/prompt capture must contain promptRequest.sessionId string",
        ));
    }
    if value
        .pointer("/promptRequest/prompt")
        .and_then(Value::as_array)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/prompt capture must contain promptRequest.prompt array",
        ));
    }
    if value
        .pointer("/promptResponse/stopReason")
        .and_then(Value::as_str)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/prompt capture must contain promptResponse.stopReason string",
        ));
    }
    if value
        .get("promptUpdates")
        .and_then(Value::as_array)
        .is_some()
    {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/prompt capture must contain promptUpdates array",
    ))
}

pub(super) fn validate_session_set_config_option(value: &Value) -> Result<()> {
    let Some(config_id) = value
        .pointer("/configRequest/configId")
        .and_then(Value::as_str)
    else {
        return Err(CliError::invalid_capture(
            "provider session/set_config_option capture must contain configRequest.configId string",
        ));
    };
    let Some(config_value) = value
        .pointer("/configRequest/value")
        .and_then(Value::as_str)
    else {
        return Err(CliError::invalid_capture(
            "provider session/set_config_option capture must contain configRequest.value string",
        ));
    };
    if value
        .pointer("/configRequest/sessionId")
        .and_then(Value::as_str)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/set_config_option capture must contain configRequest.sessionId string",
        ));
    }
    let Some(config_options) = value
        .pointer("/configResponse/configOptions")
        .and_then(Value::as_array)
    else {
        return Err(CliError::invalid_capture(
            "provider session/set_config_option capture must contain configResponse.configOptions array",
        ));
    };
    if config_options.iter().any(|option| {
        option.get("id").and_then(Value::as_str) == Some(config_id)
            && option.get("currentValue").and_then(Value::as_str) == Some(config_value)
    }) {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/set_config_option response must include selected config currentValue",
    ))
}

pub(super) fn normalize_capture(operation: &CaptureOperation, value: &Value) -> Result<Value> {
    match operation {
        CaptureOperation::Prompt { .. } => normalize_session_prompt(value),
        CaptureOperation::Initialize
        | CaptureOperation::New
        | CaptureOperation::List
        | CaptureOperation::Load { .. }
        | CaptureOperation::SetConfigOption { .. } => Ok(value.clone()),
    }
}

fn normalize_session_prompt(value: &Value) -> Result<Value> {
    let session_id = value
        .pointer("/promptRequest/sessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptRequest.sessionId string",
            )
        })?;
    let prompt = value
        .pointer("/promptRequest/prompt")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptRequest.prompt array",
            )
        })?
        .to_vec();
    let stop_reason = value
        .pointer("/promptResponse/stopReason")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptResponse.stopReason string",
            )
        })?;
    let updates: Vec<acp_core::TranscriptUpdateSnapshot> =
        serde_json::from_value(value.get("promptUpdates").cloned().ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptUpdates array",
            )
        })?)?;
    let items = session_projection::prompt_turn_items(
        "capture-turn",
        &prompt,
        &updates,
        TranscriptItemStatus::Complete,
        Some(stop_reason),
    );
    Ok(json!({
        "operation": "session/prompt",
        "sessionId": session_id,
        "prompt": prompt,
        "stopReason": stop_reason,
        "items": items,
    }))
}
