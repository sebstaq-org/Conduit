//! Validation helpers for the locked ACP method subset.

use crate::bundle::ContractBundle;
use crate::error::{Error, Result};
use agent_client_protocol_schema::{
    AGENT_METHOD_NAMES, CancelNotification, InitializeRequest, InitializeResponse,
    ListSessionsRequest, ListSessionsResponse, LoadSessionRequest, LoadSessionResponse,
    NewSessionRequest, NewSessionResponse, PromptRequest, PromptResponse,
    SetSessionConfigOptionRequest, SetSessionConfigOptionResponse,
};
use serde_json::Value;

/// The exact ACP method subset locked for Conduit Phase 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LockedMethod {
    /// `initialize`
    Initialize,
    /// `session/new`
    SessionNew,
    /// `session/list`
    SessionList,
    /// `session/load`
    SessionLoad,
    /// `session/prompt`
    SessionPrompt,
    /// `session/set_config_option`
    SessionSetConfigOption,
    /// `session/cancel`
    SessionCancel,
}

impl LockedMethod {
    /// Returns the `agentMethods` key expected in the ACP meta bundle.
    #[must_use]
    pub const fn agent_method_key(self) -> &'static str {
        match self {
            Self::Initialize => "initialize",
            Self::SessionNew => "session_new",
            Self::SessionList => "session_list",
            Self::SessionLoad => "session_load",
            Self::SessionPrompt => "session_prompt",
            Self::SessionSetConfigOption => "session_set_config_option",
            Self::SessionCancel => "session_cancel",
        }
    }

    /// Returns the ACP wire method name.
    #[must_use]
    pub const fn method_name(self) -> &'static str {
        match self {
            Self::Initialize => "initialize",
            Self::SessionNew => "session/new",
            Self::SessionList => "session/list",
            Self::SessionLoad => "session/load",
            Self::SessionPrompt => "session/prompt",
            Self::SessionSetConfigOption => "session/set_config_option",
            Self::SessionCancel => "session/cancel",
        }
    }
}

/// The locked ACP method subset in wire order.
pub const LOCKED_ACP_METHODS: [LockedMethod; 7] = [
    LockedMethod::Initialize,
    LockedMethod::SessionNew,
    LockedMethod::SessionList,
    LockedMethod::SessionLoad,
    LockedMethod::SessionPrompt,
    LockedMethod::SessionSetConfigOption,
    LockedMethod::SessionCancel,
];

/// Verifies that the vendored `meta.json` registers the full locked subset.
///
/// # Errors
///
/// Returns an error when the vendored method metadata is malformed or any
/// required Phase 1 ACP method is missing from the pinned registration map.
pub fn assert_locked_method_registration(bundle: &ContractBundle) -> Result<()> {
    let agent_methods = bundle.agent_method_map()?;
    for method in LOCKED_ACP_METHODS {
        let Some(value) = agent_methods.get(method.agent_method_key()) else {
            return Err(Error::contract(format!(
                "vendor meta.json does not register {} as {}",
                method.agent_method_key(),
                method.method_name()
            )));
        };
        if value != method.method_name() {
            return Err(Error::contract(format!(
                "vendor meta.json registers {} as {}, expected {}",
                method.agent_method_key(),
                value,
                method.method_name()
            )));
        }
    }

    Ok(())
}

/// Validates a client-to-agent request envelope for the locked subset.
///
/// # Errors
///
/// Returns an error when the envelope fails the vendored ACP schema, is missing
/// required JSON-RPC fields, or does not decode as one of the locked request
/// payloads.
pub fn validate_locked_request_envelope(
    bundle: &ContractBundle,
    envelope: &Value,
) -> Result<LockedMethod> {
    validate_schema(bundle, envelope)?;
    let method = method_field(envelope)?;
    let params = params_field(envelope)?;
    match method {
        m if m == AGENT_METHOD_NAMES.initialize => {
            validate_params::<InitializeRequest>(params)?;
            Ok(LockedMethod::Initialize)
        }
        "session/new" => {
            validate_params::<NewSessionRequest>(params)?;
            Ok(LockedMethod::SessionNew)
        }
        "session/list" => {
            validate_params::<ListSessionsRequest>(params)?;
            Ok(LockedMethod::SessionList)
        }
        "session/load" => {
            validate_load_session_request(params)?;
            Ok(LockedMethod::SessionLoad)
        }
        "session/prompt" => {
            validate_params::<PromptRequest>(params)?;
            Ok(LockedMethod::SessionPrompt)
        }
        "session/set_config_option" => {
            validate_params::<SetSessionConfigOptionRequest>(params)?;
            Ok(LockedMethod::SessionSetConfigOption)
        }
        "session/cancel" => Err(Error::contract(
            "session/cancel is a notification and must be validated separately",
        )),
        _ => Err(Error::contract(format!(
            "{method} is outside the locked ACP request subset"
        ))),
    }
}

/// Validates a client-to-agent cancel notification envelope.
///
/// # Errors
///
/// Returns an error when the envelope fails the vendored ACP schema, is not the
/// locked `session/cancel` notification, or does not decode as the official ACP
/// cancel payload.
pub fn validate_locked_cancel_notification(
    bundle: &ContractBundle,
    envelope: &Value,
) -> Result<()> {
    validate_schema(bundle, envelope)?;
    let method = method_field(envelope)?;
    if method != AGENT_METHOD_NAMES.session_cancel {
        return Err(Error::contract(format!(
            "{method} is not the locked session/cancel notification"
        )));
    }
    validate_params::<CancelNotification>(params_field(envelope)?)?;
    Ok(())
}

/// Validates an agent-to-client response envelope for a specific locked method.
///
/// # Errors
///
/// Returns an error when the envelope fails the vendored ACP schema, is missing
/// a `result` payload, decodes as the wrong ACP response type, or is asked to
/// validate `session/cancel`, which does not produce a direct response envelope.
pub fn validate_locked_response_envelope(
    bundle: &ContractBundle,
    method: LockedMethod,
    envelope: &Value,
) -> Result<()> {
    validate_schema(bundle, envelope)?;
    let result = result_field(envelope)?;
    match method {
        LockedMethod::Initialize => validate_result::<InitializeResponse>(result),
        LockedMethod::SessionNew => validate_result::<NewSessionResponse>(result),
        LockedMethod::SessionList => validate_result::<ListSessionsResponse>(result),
        LockedMethod::SessionLoad => validate_result::<LoadSessionResponse>(result),
        LockedMethod::SessionPrompt => validate_result::<PromptResponse>(result),
        LockedMethod::SessionSetConfigOption => {
            validate_result::<SetSessionConfigOptionResponse>(result)
        }
        LockedMethod::SessionCancel => Err(Error::contract(
            "session/cancel does not produce a direct ACP response envelope",
        )),
    }
}

fn validate_schema(bundle: &ContractBundle, envelope: &Value) -> Result<()> {
    let messages = bundle
        .validator
        .iter_errors(envelope)
        .map(|error| error.to_string())
        .collect::<Vec<_>>();
    if messages.is_empty() {
        return Ok(());
    }

    Err(Error::schema(messages))
}

fn method_field(envelope: &Value) -> Result<&str> {
    envelope
        .get("method")
        .and_then(Value::as_str)
        .ok_or_else(|| Error::contract("ACP envelope is missing a method string"))
}

fn params_field(envelope: &Value) -> Result<&Value> {
    envelope
        .get("params")
        .ok_or_else(|| Error::contract("ACP request or notification is missing params"))
}

fn result_field(envelope: &Value) -> Result<&Value> {
    envelope
        .get("result")
        .ok_or_else(|| Error::contract("ACP response is missing result"))
}

fn validate_params<T>(params: &Value) -> Result<()>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_value::<T>(params.clone())
        .map(|_| ())
        .map_err(|error| Error::contract(error.to_string()))
}

fn validate_result<T>(result: &Value) -> Result<()>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_value::<T>(result.clone())
        .map(|_| ())
        .map_err(|error| Error::contract(error.to_string()))
}

fn validate_load_session_request(params: &Value) -> Result<()> {
    let request = serde_json::from_value::<LoadSessionRequest>(params.clone())
        .map_err(|error| Error::contract(error.to_string()))?;
    if request.cwd.is_absolute() {
        return Ok(());
    }
    Err(Error::contract("session/load cwd must be absolute"))
}
