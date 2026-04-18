//! Session prompt fixture indexing.

use crate::{invalid_fixture, read_json};
use acp_core::{
    LiveSessionIdentity, PromptLifecycleSnapshot, PromptLifecycleState, TranscriptUpdateSnapshot,
};
use acp_discovery::ProviderId;
use serde_json::Value;
use service_runtime::{Result, RuntimeError};
use std::collections::HashMap;
use std::fs::read_dir;
use std::path::Path;

#[derive(Debug, Clone)]
pub(crate) struct SessionPromptFixture {
    pub(crate) prompt: Vec<Value>,
    pub(crate) required_config: Option<RequiredPromptConfig>,
    pub(crate) response: Value,
    pub(crate) stop_reason: String,
    pub(crate) updates: Vec<TranscriptUpdateSnapshot>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct RequiredPromptConfig {
    pub(crate) config_id: String,
    pub(crate) value: String,
}

impl SessionPromptFixture {
    pub(crate) fn lifecycle(
        &self,
        provider: ProviderId,
        session_id: String,
    ) -> PromptLifecycleSnapshot {
        PromptLifecycleSnapshot {
            identity: LiveSessionIdentity {
                provider,
                acp_session_id: session_id,
            },
            state: PromptLifecycleState::Completed,
            stop_reason: Some(self.stop_reason.clone()),
            raw_update_count: self.updates.len(),
            agent_text_chunks: agent_text_chunks(&self.updates),
            updates: self.updates.clone(),
        }
    }
}

pub(crate) fn read_session_prompt_fixtures(
    root: &Path,
    provider: ProviderId,
    fixtures: &mut HashMap<(ProviderId, String), SessionPromptFixture>,
) -> Result<()> {
    let root = session_prompt_root(root, provider);
    if !root.exists() {
        return Ok(());
    }
    if !root.is_dir() {
        return Err(invalid_fixture(&root, "must be a directory"));
    }
    for session_entry in read_dir(&root).map_err(|source| {
        RuntimeError::Provider(format!(
            "failed to read fixture directory {}: {source}",
            root.display()
        ))
    })? {
        let session_entry = session_entry.map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to read fixture directory entry {}: {source}",
                root.display()
            ))
        })?;
        if !session_entry
            .file_type()
            .map_err(|source| {
                RuntimeError::Provider(format!(
                    "failed to read fixture file type {}: {source}",
                    session_entry.path().display()
                ))
            })?
            .is_dir()
        {
            continue;
        }
        read_session_prompt_session_fixtures(provider, &session_entry.path(), fixtures)?;
    }
    Ok(())
}

fn read_session_prompt_session_fixtures(
    provider: ProviderId,
    session_root: &Path,
    fixtures: &mut HashMap<(ProviderId, String), SessionPromptFixture>,
) -> Result<()> {
    for entry in read_dir(session_root).map_err(|source| {
        RuntimeError::Provider(format!(
            "failed to read fixture directory {}: {source}",
            session_root.display()
        ))
    })? {
        let entry = entry.map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to read fixture directory entry {}: {source}",
                session_root.display()
            ))
        })?;
        if !entry
            .file_type()
            .map_err(|source| {
                RuntimeError::Provider(format!(
                    "failed to read fixture file type {}: {source}",
                    entry.path().display()
                ))
            })?
            .is_dir()
        {
            continue;
        }
        let path = entry.path().join("provider.raw.json");
        if !path.exists() {
            continue;
        }
        let (session_id, fixture) = read_session_prompt_fixture(&path)?;
        if fixtures
            .insert((provider, session_id.clone()), fixture)
            .is_some()
        {
            return Err(invalid_fixture(
                &path,
                "duplicate session/prompt session id",
            ));
        }
    }
    Ok(())
}

fn read_session_prompt_fixture(path: &Path) -> Result<(String, SessionPromptFixture)> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    let session_id = session_prompt_session_id(path, &value)?;
    let prompt_value = value
        .pointer("/promptRequest/prompt")
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain promptRequest.prompt array"))?;
    let prompt = prompt_value
        .as_array()
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain promptRequest.prompt array"))?;
    let required_config = required_prompt_config(path, &value)?;
    let response = value
        .get("promptResponse")
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain a promptResponse field"))?;
    let stop_reason = response
        .get("stopReason")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_fixture(path, "must contain promptResponse.stopReason string"))?;
    let updates_value = value
        .get("promptUpdates")
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain promptUpdates array"))?;
    if !updates_value.is_array() {
        return Err(invalid_fixture(path, "must contain promptUpdates array"));
    }
    let updates: Vec<TranscriptUpdateSnapshot> =
        serde_json::from_value(updates_value).map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to parse fixture {} promptUpdates: {source}",
                path.display()
            ))
        })?;
    Ok((
        session_id,
        SessionPromptFixture {
            prompt,
            required_config,
            response,
            stop_reason,
            updates,
        },
    ))
}

fn session_prompt_session_id(path: &Path, value: &Value) -> Result<String> {
    if let Some(session_id) = manifest_session_id(path)? {
        return Ok(session_id);
    }
    value
        .pointer("/promptRequest/sessionId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            invalid_fixture(
                path,
                "must identify session id via manifest or promptRequest.sessionId",
            )
        })
}

fn manifest_session_id(path: &Path) -> Result<Option<String>> {
    let Some(capture_dir) = path.parent() else {
        return Ok(None);
    };
    let manifest_path = capture_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Ok(None);
    }
    let manifest = read_json(&manifest_path)?;
    Ok(manifest
        .get("sessionId")
        .or_else(|| manifest.get("session_id"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned))
}

fn required_prompt_config(path: &Path, value: &Value) -> Result<Option<RequiredPromptConfig>> {
    let Some(capture) = value.get("configCapture") else {
        return Ok(None);
    };
    if capture.is_null() {
        return Ok(None);
    }
    let config_id = capture
        .pointer("/configRequest/configId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            invalid_fixture(path, "must contain configCapture.configRequest.configId")
        })?;
    let config_value = capture
        .pointer("/configRequest/value")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_fixture(path, "must contain configCapture.configRequest.value"))?;
    Ok(Some(RequiredPromptConfig {
        config_id,
        value: config_value,
    }))
}

fn agent_text_chunks(updates: &[TranscriptUpdateSnapshot]) -> Vec<String> {
    updates
        .iter()
        .filter(|update| update.variant == "agent_message_chunk")
        .filter_map(|update| {
            update
                .update
                .get("content")
                .and_then(|content| content.get("text"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect()
}

fn session_prompt_root(root: &Path, provider: ProviderId) -> std::path::PathBuf {
    root.join(provider.as_str()).join("session-prompt")
}
