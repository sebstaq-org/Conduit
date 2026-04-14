//! Shared manager response helpers.

use crate::Result;
use crate::error::RuntimeError;
use crate::manager_helpers::prompt_lifecycle;
use acp_core::{ProviderSnapshot, TranscriptUpdateSnapshot};
use serde_json::Value;

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
