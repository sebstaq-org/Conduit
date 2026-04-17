//! Session new fixture indexing.

use crate::{invalid_fixture, read_json};
use acp_discovery::ProviderId;
use serde_json::Value;
use service_runtime::{Result, RuntimeError};
use std::collections::HashMap;
use std::fs::read_dir;
use std::path::Path;

pub(crate) fn read_session_new_fixtures(
    root: &Path,
    provider: ProviderId,
    fixtures: &mut HashMap<ProviderId, Value>,
) -> Result<()> {
    let root = session_new_root(root, provider);
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
        let path = entry.path().join("provider.raw.json");
        if !path.exists() {
            continue;
        }
        let fixture = read_session_new_fixture(&path)?;
        if fixtures.insert(provider, fixture).is_some() {
            return Err(invalid_fixture(&path, "duplicate session/new fixture"));
        }
    }
    Ok(())
}

fn read_session_new_fixture(path: &Path) -> Result<Value> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    if value.get("sessionId").and_then(Value::as_str).is_none() {
        return Err(invalid_fixture(path, "must contain a sessionId string"));
    }
    Ok(value)
}

fn session_new_root(root: &Path, provider: ProviderId) -> std::path::PathBuf {
    root.join(provider.as_str()).join("session-new")
}
