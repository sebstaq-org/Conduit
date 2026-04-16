//! Backend-owned consumer contracts and schema export.

use crate::{Result, RuntimeError};
use acp_core::{
    ConnectionState, LiveSessionIdentity, LiveSessionSnapshot, LoadedTranscriptSnapshot,
    PromptLifecycleSnapshot, PromptLifecycleState, ProviderSnapshot, RawWireEvent,
    TranscriptUpdateSnapshot,
};
use acp_discovery::{LauncherCommand, ProviderDiscovery, ProviderId};
use agent_client_protocol_schema::{
    ContentBlock, LoadSessionResponse, NewSessionResponse, SessionConfigOption, SessionModeState,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, to_value};
use session_store::{
    GlobalSettings as GlobalSettingsView, ProjectRow, ProjectSuggestion, SessionHistoryWindow,
    TranscriptItem,
};
use std::collections::BTreeMap;
use std::sync::OnceLock;

const CONTRACT_BUNDLE_VERSION: u32 = 1;
pub(super) const TRANSPORT_PROTOCOL_VERSION: u8 = 1;
pub(super) const MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS: u64 = 1;
pub(super) const MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS: u64 = 365;

macro_rules! string_literal_enum {
    ($name:ident, $value:literal) => {
        #[doc = "Stable string literal used by the generated consumer contract."]
        #[derive(
            Debug,
            Clone,
            Copy,
            PartialEq,
            Eq,
            ::serde::Serialize,
            ::serde::Deserialize,
            ::schemars::JsonSchema,
        )]
        pub enum $name {
            #[doc = "The only supported literal value for this contract field."]
            #[serde(rename = $value)]
            Value,
        }
    };
}

macro_rules! exported_contract_types {
    ($macro:ident) => {
        $macro!(ProviderId);
        $macro!(ConsumerCommandName);
        $macro!(GlobalProviderTarget);
        $macro!(ConsumerCommandTarget);
        $macro!(LauncherCommand);
        $macro!(ProviderDiscovery);
        $macro!(ConnectionState);
        $macro!(LiveSessionIdentity);
        $macro!(LiveSessionSnapshot);
        $macro!(PromptLifecycleState);
        $macro!(PromptLifecycleSnapshot);
        $macro!(TranscriptUpdateSnapshot);
        $macro!(LoadedTranscriptSnapshot);
        $macro!(ProviderSnapshot);
        $macro!(RawWireEvent);
        $macro!(ContentBlock);
        $macro!(SessionConfigOption);
        $macro!(SessionModeState);
        $macro!(GlobalSettingsView);
        $macro!(ProjectRow);
        $macro!(ProjectSuggestion);
        $macro!(TranscriptItem);
        $macro!(SessionHistoryWindow);
        $macro!(ProjectAddRequest);
        $macro!(ProjectRemoveRequest);
        $macro!(ProjectUpdateRequest);
        $macro!(ProjectSuggestionsQuery);
        $macro!(ProjectListView);
        $macro!(ProjectSuggestionsView);
        $macro!(SessionGroupsQuery);
        $macro!(SessionRow);
        $macro!(SessionGroup);
        $macro!(SessionGroupsView);
        $macro!(GlobalSettingsUpdateRequest);
        $macro!(SessionNewRequest);
        $macro!(SessionOpenRequest);
        $macro!(SessionHistoryRequest);
        $macro!(SessionWatchRequest);
        $macro!(SessionPromptRequest);
        $macro!(SessionSetConfigOptionRequest);
        $macro!(SessionStateProjection);
        $macro!(SessionNewResult);
        $macro!(SessionOpenResult);
        $macro!(SessionSetConfigOptionResult);
        $macro!(ProviderConfigSnapshotStatus);
        $macro!(ProviderConfigSnapshotEntry);
        $macro!(ProvidersConfigSnapshotResult);
        $macro!(EmptyParams);
        $macro!(SessionCancelRequest);
        $macro!(ConsumerError);
        $macro!(ConsumerResponse);
        $macro!(ConsumerCommand);
        $macro!(RuntimeEvent);
        $macro!(ClientCommandFrame);
        $macro!(ServerResponseFrame);
        $macro!(ServerEventFrame);
        $macro!(ServerFrame);
    };
}

mod model;
mod wire;

pub use self::model::{
    GlobalSettingsUpdateRequest, ProjectAddRequest, ProjectListView, ProjectRemoveRequest,
    ProjectSuggestionsQuery, ProjectSuggestionsView, ProjectUpdateRequest,
    ProviderConfigSnapshotEntry, ProviderConfigSnapshotStatus, ProvidersConfigSnapshotResult,
    SessionGroup, SessionGroupsQuery, SessionGroupsView, SessionHistoryRequest, SessionNewRequest,
    SessionNewResult, SessionOpenRequest, SessionOpenResult, SessionPromptRequest, SessionRow,
    SessionSetConfigOptionRequest, SessionSetConfigOptionResult, SessionStateProjection,
    SessionWatchRequest,
};
pub use self::wire::{
    ClientCommandFrame, ConsumerCommand, ConsumerCommandName, ConsumerCommandTarget, ConsumerError,
    ConsumerResponse, EmptyParams, GlobalProviderTarget, RuntimeEvent, ServerEventFrame,
    ServerEventFrameType, ServerFrame, ServerResponseFrame, ServerResponseFrameType,
    SessionCancelRequest,
};

/// One generated bundle of backend-owned consumer contracts.
#[derive(Debug, Clone, Serialize)]
pub struct ConsumerContractBundle {
    /// Schema bundle format version.
    pub version: u32,
    /// Root contracts keyed by stable export name.
    pub roots: BTreeMap<String, Value>,
}

/// Exports the backend-owned consumer contract bundle.
#[must_use]
pub fn export_contract_bundle() -> ConsumerContractBundle {
    ConsumerContractBundle {
        version: CONTRACT_BUNDLE_VERSION,
        roots: contract_schemas().clone(),
    }
}

/// Serializes one typed contract payload and validates it against the generated schema.
///
/// # Errors
///
/// Returns an error when serialization fails or the serialized value violates
/// the named generated schema.
pub fn to_contract_value<T>(contract: &'static str, value: &T) -> Result<Value>
where
    T: Serialize,
{
    let json = to_value(value)?;
    validate_contract_value(contract, &json)?;
    Ok(json)
}

/// Validates one JSON payload against a generated contract schema.
///
/// # Errors
///
/// Returns an error when the schema is missing, invalid, or rejects the value.
pub fn validate_contract_value(contract: &'static str, value: &Value) -> Result<()> {
    let Some(schema) = contract_schemas().get(contract) else {
        return Err(RuntimeError::ContractViolation {
            contract,
            message: "missing generated schema".to_owned(),
        });
    };
    let validator =
        jsonschema::validator_for(schema).map_err(|error| RuntimeError::ContractViolation {
            contract,
            message: error.to_string(),
        })?;
    if validator.is_valid(value) {
        return Ok(());
    }
    let message = validator
        .iter_errors(value)
        .map(|error| error.to_string())
        .collect::<Vec<_>>()
        .join("; ");
    Err(RuntimeError::ContractViolation { contract, message })
}

/// Decodes backend-owned params using the generated request contract.
pub(crate) fn from_params<T>(
    command: &'static str,
    contract: &'static str,
    params: &Value,
) -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    if let Err(error) = validate_contract_value(contract, params) {
        let message = match error {
            RuntimeError::ContractViolation { message, .. } => message,
            other => other.to_string(),
        };
        return Err(RuntimeError::InvalidContractInput { command, message });
    }
    serde_json::from_value(params.clone()).map_err(|error| RuntimeError::InvalidContractInput {
        command,
        message: error.to_string(),
    })
}

/// Projects provider `session/new` state onto the stable Conduit state model.
///
/// # Errors
///
/// Returns an error when the provider result cannot be decoded as ACP
/// `session/new` state.
pub fn session_state_from_new_result(
    session_id: &str,
    result: &Value,
) -> Result<SessionStateProjection> {
    let response =
        serde_json::from_value::<NewSessionResponse>(result.clone()).map_err(|error| {
            RuntimeError::ContractViolation {
                contract: "SessionStateProjection",
                message: error.to_string(),
            }
        })?;
    Ok(SessionStateProjection {
        session_id: session_id.to_owned(),
        modes: response.modes,
        models: result.get("models").cloned(),
        config_options: response.config_options,
    })
}

/// Projects provider `session/load` state onto the stable Conduit state model.
///
/// # Errors
///
/// Returns an error when the provider result cannot be decoded as ACP
/// `session/load` state.
pub fn session_state_from_load_result(
    session_id: &str,
    result: &Value,
) -> Result<SessionStateProjection> {
    let response =
        serde_json::from_value::<LoadSessionResponse>(result.clone()).map_err(|error| {
            RuntimeError::ContractViolation {
                contract: "SessionStateProjection",
                message: error.to_string(),
            }
        })?;
    Ok(SessionStateProjection {
        session_id: session_id.to_owned(),
        modes: response.modes,
        models: result.get("models").cloned(),
        config_options: response.config_options,
    })
}

static CONTRACT_SCHEMAS: OnceLock<BTreeMap<String, Value>> = OnceLock::new();

fn contract_schemas() -> &'static BTreeMap<String, Value> {
    CONTRACT_SCHEMAS.get_or_init(|| {
        let mut roots = BTreeMap::new();
        macro_rules! insert_schema {
            ($type_name:ident) => {
                roots.insert(
                    stringify!($type_name).to_owned(),
                    serde_json::to_value(schemars::schema_for!($type_name))
                        .expect("generated contract schema should serialize"),
                );
            };
        }
        exported_contract_types!(insert_schema);
        roots
    })
}
