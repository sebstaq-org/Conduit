//! Shared manager response helpers.

use crate::Result;
use crate::error::RuntimeError;
use crate::manager_helpers::prompt_lifecycle;
use acp_core::{ProviderSnapshot, TranscriptUpdateSnapshot};
use serde_json::{Value, json};

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
    result
        .get("sessionId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or(RuntimeError::Provider(
            "session/new result missing sessionId".to_owned(),
        ))
}

pub(crate) fn store_lock_error<T>(error: std::sync::PoisonError<T>) -> RuntimeError {
    RuntimeError::Provider(format!("local store lock poisoned: {error}"))
}

pub(crate) fn session_state_from_provider_result(session_id: &str, result: &Value) -> Value {
    json!({
        "sessionId": session_id,
        "configOptions": result.get("configOptions").cloned(),
        "modes": result.get("modes").cloned(),
        "models": result.get("models").cloned(),
    })
}

pub(crate) fn session_open_or_new_result(state: &Value, history: &Value) -> Value {
    json!({
        "sessionId": state.get("sessionId").cloned().unwrap_or(Value::Null),
        "configOptions": state.get("configOptions").cloned().unwrap_or(Value::Null),
        "modes": state.get("modes").cloned().unwrap_or(Value::Null),
        "models": state.get("models").cloned().unwrap_or(Value::Null),
        "history": history,
    })
}

pub(crate) fn session_open_result(state: &Value, history: &Value) -> Value {
    json!({
        "sessionId": state.get("sessionId").cloned().unwrap_or(Value::Null),
        "configOptions": state.get("configOptions").cloned().unwrap_or(Value::Null),
        "modes": state.get("modes").cloned().unwrap_or(Value::Null),
        "models": state.get("models").cloned().unwrap_or(Value::Null),
        "openSessionId": history.get("openSessionId").cloned().unwrap_or(Value::Null),
        "revision": history.get("revision").cloned().unwrap_or(Value::Null),
        "items": history.get("items").cloned().unwrap_or(Value::Null),
        "nextCursor": history.get("nextCursor").cloned().unwrap_or(Value::Null),
    })
}

pub(crate) fn session_set_config_option_result(
    session_id: &str,
    result: &Value,
) -> Result<Value> {
    let Some(config_options) = result.get("configOptions").cloned() else {
        return Err(RuntimeError::Provider(
            "session/set_config_option result missing configOptions".to_owned(),
        ));
    };
    Ok(json!({
        "sessionId": session_id,
        "configOptions": config_options
    }))
}
