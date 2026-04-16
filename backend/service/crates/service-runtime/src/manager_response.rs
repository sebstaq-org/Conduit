//! Shared manager response helpers.

use crate::Result;
use crate::contracts::{
    SessionNewResult, SessionOpenResult, SessionSetConfigOptionResult, SessionStateProjection,
    session_state_from_load_result, session_state_from_new_result, to_contract_value,
};
use crate::error::RuntimeError;
use crate::manager_helpers::prompt_lifecycle;
use acp_core::{ProviderSnapshot, TranscriptUpdateSnapshot};
use agent_client_protocol_schema::{NewSessionResponse, SetSessionConfigOptionResponse};
use serde_json::Value;
use session_store::SessionHistoryWindow;

pub(crate) fn append_snapshot_updates_if_missing(
    observed_updates: &mut Vec<TranscriptUpdateSnapshot>,
    snapshot: &ProviderSnapshot,
    session_id: &str,
) {
    if observed_updates.is_empty()
        && let Some(lifecycle) = prompt_lifecycle(snapshot, session_id)
    {
        observed_updates.extend(lifecycle.updates.clone());
    }
}

pub(crate) fn session_new_result_id(result: &Value) -> Result<String> {
    serde_json::from_value::<NewSessionResponse>(result.clone())
        .map(|response| response.session_id.to_string())
        .map_err(|error| RuntimeError::Provider(error.to_string()))
}

pub(crate) fn store_lock_error<T>(error: std::sync::PoisonError<T>) -> RuntimeError {
    RuntimeError::Provider(format!("local store lock poisoned: {error}"))
}

pub(crate) fn session_new_state(
    session_id: &str,
    result: &Value,
) -> Result<SessionStateProjection> {
    session_state_from_new_result(session_id, result)
}

pub(crate) fn session_open_state(
    session_id: &str,
    result: &Value,
) -> Result<SessionStateProjection> {
    session_state_from_load_result(session_id, result)
}

pub(crate) fn session_new_result(
    state: &SessionStateProjection,
    history: SessionHistoryWindow,
) -> Result<Value> {
    to_contract_value(
        "SessionNewResult",
        &SessionNewResult {
            session_id: state.session_id.clone(),
            modes: state.modes.clone(),
            models: state.models.clone(),
            config_options: state.config_options.clone(),
            history,
        },
    )
}

pub(crate) fn session_open_result(
    state: &SessionStateProjection,
    history: SessionHistoryWindow,
) -> Result<Value> {
    to_contract_value(
        "SessionOpenResult",
        &SessionOpenResult {
            session_id: state.session_id.clone(),
            modes: state.modes.clone(),
            models: state.models.clone(),
            config_options: state.config_options.clone(),
            open_session_id: history.open_session_id,
            revision: history.revision,
            items: history.items,
            next_cursor: history.next_cursor,
        },
    )
}

pub(crate) fn session_set_config_option_result(session_id: &str, result: &Value) -> Result<Value> {
    let response = serde_json::from_value::<SetSessionConfigOptionResponse>(result.clone())
        .map_err(|error| RuntimeError::Provider(error.to_string()))?;
    to_contract_value(
        "SessionSetConfigOptionResult",
        &SessionSetConfigOptionResult {
            session_id: session_id.to_owned(),
            config_options: response.config_options,
        },
    )
}
