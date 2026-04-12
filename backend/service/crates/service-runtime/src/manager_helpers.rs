//! Helper functions for the provider manager.

use crate::error::RuntimeError;
use crate::session_groups::{entries_from_session_list, next_cursor, normalize_cwd};
use crate::{ProviderPort, Result};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use session_store::TranscriptItemStatus;
use std::collections::HashSet;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn absolute_normalized_cwd(command: &'static str, cwd: PathBuf) -> Result<PathBuf> {
    if !cwd.is_absolute() {
        return Err(RuntimeError::InvalidParameter {
            command,
            parameter: "cwd",
            message: "cwd must be absolute",
        });
    }
    Ok(PathBuf::from(normalize_cwd(&cwd.display().to_string())))
}

pub(crate) fn parse_provider(value: &str) -> Result<ProviderId> {
    ProviderId::from_str(value).map_err(|message| RuntimeError::UnknownProvider {
        provider: value.to_owned(),
        message,
    })
}

pub(crate) fn paginated_index_entries(
    provider_port: &mut dyn ProviderPort,
    provider: ProviderId,
) -> Result<Vec<session_store::SessionIndexEntry>> {
    let mut entries = Vec::new();
    let mut cursor = None;
    let mut seen_cursors = HashSet::new();
    loop {
        let result = provider_port.session_list(None, cursor.clone())?;
        entries.extend(entries_from_session_list(provider, &result)?);
        cursor = next_cursor(&result)?;
        let Some(next_cursor) = &cursor else {
            break;
        };
        if !seen_cursors.insert(next_cursor.clone()) {
            return Err(RuntimeError::Provider(
                "session/list returned a repeated nextCursor".to_owned(),
            ));
        }
    }
    Ok(entries)
}

pub(crate) fn current_epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

pub(crate) fn loaded_transcript_updates(
    snapshot: &acp_core::ProviderSnapshot,
    session_id: &str,
) -> Vec<Value> {
    snapshot
        .loaded_transcripts
        .iter()
        .find(|transcript| transcript.identity.acp_session_id == session_id)
        .map(|transcript| {
            transcript
                .updates
                .iter()
                .map(|update| {
                    json!({
                        "replay_index": update.index,
                        "session_update": update.variant,
                        "update": update.update,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn loaded_transcript_snapshot_updates<'a>(
    snapshot: &'a acp_core::ProviderSnapshot,
    session_id: &str,
) -> &'a [acp_core::TranscriptUpdateSnapshot] {
    snapshot
        .loaded_transcripts
        .iter()
        .find(|transcript| transcript.identity.acp_session_id == session_id)
        .map(|transcript| transcript.updates.as_slice())
        .unwrap_or_default()
}

pub(crate) fn content_blocks_param(
    command: &'static str,
    params: &Value,
    parameter: &'static str,
) -> Result<Vec<Value>> {
    let Some(value) = params.get(parameter) else {
        return Err(RuntimeError::MissingParameter { command, parameter });
    };
    value
        .as_array()
        .cloned()
        .ok_or(RuntimeError::InvalidParameter {
            command,
            parameter,
            message: "must be a ContentBlock array",
        })
}

pub(crate) fn prompt_lifecycle<'a>(
    snapshot: &'a acp_core::ProviderSnapshot,
    session_id: &str,
) -> Option<&'a acp_core::PromptLifecycleSnapshot> {
    snapshot
        .last_prompt
        .as_ref()
        .filter(|prompt| prompt.identity.acp_session_id == session_id)
}

pub(crate) fn prompt_status(
    lifecycle: Option<&acp_core::PromptLifecycleSnapshot>,
) -> TranscriptItemStatus {
    match lifecycle.map(|value| value.state) {
        Some(acp_core::PromptLifecycleState::Cancelled) => TranscriptItemStatus::Cancelled,
        Some(acp_core::PromptLifecycleState::Running) => TranscriptItemStatus::Streaming,
        Some(acp_core::PromptLifecycleState::Idle) => TranscriptItemStatus::Failed,
        Some(acp_core::PromptLifecycleState::Completed) => TranscriptItemStatus::Complete,
        None => TranscriptItemStatus::Failed,
    }
}
