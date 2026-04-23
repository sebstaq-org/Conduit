//! Session load fixture indexing.

use crate::failure::{ProviderFailureFixture, read_provider_failure_fixture};
use crate::{invalid_fixture, read_json};
use acp_core::{LiveSessionIdentity, LoadedTranscriptSnapshot, TranscriptUpdateSnapshot};
use acp_discovery::ProviderId;
use serde_json::Value;
use service_runtime::{Result, RuntimeError};
use std::collections::HashMap;
use std::fs::read_dir;
use std::path::Path;

#[derive(Debug, Clone)]
pub(crate) enum SessionLoadFixture {
    Failure(ProviderFailureFixture),
    Success(SessionLoadSuccessFixture),
}

#[derive(Debug, Clone)]
pub(crate) struct SessionLoadSuccessFixture {
    pub(crate) response: Value,
    pub(crate) loaded_transcript: LoadedTranscriptSnapshot,
}

pub(crate) fn read_session_load_fixtures(
    root: &Path,
    provider: ProviderId,
    fixtures: &mut HashMap<(ProviderId, String), SessionLoadFixture>,
) -> Result<()> {
    let root = session_load_root(root, provider);
    if !root.exists() {
        return Ok(());
    }
    if !root.is_dir() {
        return Err(invalid_fixture(&root, "must be a directory"));
    }
    for entry in read_dir(&root).map_err(|source| {
        RuntimeError::Provider(format!(
            "failed to read fixture directory {}: {source}",
            root.display()
        ))
    })? {
        let entry = entry.map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to read fixture directory entry {}: {source}",
                root.display()
            ))
        })?;
        let file_type = entry.file_type().map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to read fixture file type {}: {source}",
                entry.path().display()
            ))
        })?;
        if !file_type.is_dir() {
            continue;
        }
        let entry_path = entry.path();
        let Some((session_id, fixture)) = read_session_load_entry(&entry_path, provider)? else {
            continue;
        };
        if fixtures
            .insert((provider, session_id.clone()), fixture)
            .is_some()
        {
            return Err(invalid_fixture(
                &entry_path,
                "duplicate session/load session id",
            ));
        }
    }
    Ok(())
}

fn read_session_load_entry(
    entry_path: &Path,
    provider: ProviderId,
) -> Result<Option<(String, SessionLoadFixture)>> {
    let success_path = entry_path.join("provider.raw.json");
    if success_path.exists() {
        return read_session_load_fixture(&success_path, provider).map(Some);
    }
    let failure_path = entry_path.join("failure.json");
    if failure_path.exists() {
        return read_session_load_failure(&failure_path).map(Some);
    }
    Ok(None)
}

fn read_session_load_fixture(
    path: &Path,
    provider: ProviderId,
) -> Result<(String, SessionLoadFixture)> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    let response = value
        .get("response")
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain a response field"))?;
    let raw_update_count = value
        .pointer("/loadedTranscript/rawUpdateCount")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            invalid_fixture(path, "must contain loadedTranscript.rawUpdateCount number")
        })?;
    let raw_update_count = usize::try_from(raw_update_count).map_err(|error| {
        RuntimeError::Provider(format!(
            "invalid fixture {}: loadedTranscript.rawUpdateCount is too large: {error}",
            path.display()
        ))
    })?;
    let updates_value = value
        .pointer("/loadedTranscript/updates")
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain loadedTranscript.updates array"))?;
    if !updates_value.is_array() {
        return Err(invalid_fixture(
            path,
            "must contain loadedTranscript.updates array",
        ));
    }
    let updates: Vec<TranscriptUpdateSnapshot> =
        serde_json::from_value(updates_value).map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to parse fixture {} loadedTranscript.updates: {source}",
                path.display()
            ))
        })?;
    let session_id = session_load_session_id(path, &value)?;
    let loaded_transcript = LoadedTranscriptSnapshot {
        identity: LiveSessionIdentity {
            provider,
            acp_session_id: session_id.clone(),
        },
        raw_update_count,
        updates,
    };
    Ok((
        session_id,
        SessionLoadFixture::Success(SessionLoadSuccessFixture {
            response,
            loaded_transcript,
        }),
    ))
}

fn read_session_load_failure(path: &Path) -> Result<(String, SessionLoadFixture)> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    let failure = read_provider_failure_fixture(path, "session/load")?;
    let session_id = session_load_session_id(path, &value)?;
    Ok((session_id, SessionLoadFixture::Failure(failure)))
}

fn session_load_session_id(path: &Path, value: &Value) -> Result<String> {
    if let Some(session_id) = manifest_session_id(path)? {
        return Ok(session_id);
    }
    value
        .pointer("/loadedTranscript/identity/acpSessionId")
        .or_else(|| value.get("sessionId"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            invalid_fixture(
                path,
                "must identify session id via manifest or loadedTranscript.identity.acpSessionId",
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

fn session_load_root(root: &Path, provider: ProviderId) -> std::path::PathBuf {
    root.join(provider.as_str()).join("session-load")
}
