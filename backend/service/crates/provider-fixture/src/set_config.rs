//! Session config option fixture indexing.

use crate::{invalid_fixture, read_json};
use acp_discovery::ProviderId;
use serde_json::Value;
use service_runtime::{Result, RuntimeError};
use std::collections::HashMap;
use std::fs::read_dir;
use std::path::Path;

#[derive(Debug, Clone)]
pub(crate) struct SessionSetConfigOptionFixture {
    pub(crate) response: Value,
}

pub(crate) fn read_session_set_config_option_fixtures(
    root: &Path,
    provider: ProviderId,
    fixtures: &mut HashMap<(ProviderId, String, String, String), SessionSetConfigOptionFixture>,
) -> Result<()> {
    let root = session_set_config_option_root(root, provider);
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
        read_session_set_config_option_session_fixtures(provider, &session_entry.path(), fixtures)?;
    }
    Ok(())
}

fn read_session_set_config_option_session_fixtures(
    provider: ProviderId,
    session_root: &Path,
    fixtures: &mut HashMap<(ProviderId, String, String, String), SessionSetConfigOptionFixture>,
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
        let (session_id, config_id, value, fixture) =
            read_session_set_config_option_fixture(&path)?;
        if fixtures
            .insert((provider, session_id, config_id, value), fixture)
            .is_some()
        {
            return Err(invalid_fixture(
                &path,
                "duplicate session/set_config_option fixture",
            ));
        }
    }
    Ok(())
}

fn read_session_set_config_option_fixture(
    path: &Path,
) -> Result<(String, String, String, SessionSetConfigOptionFixture)> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    let session_id = required_request_string(path, &value, "sessionId")?;
    let config_id = required_request_string(path, &value, "configId")?;
    let config_value = required_request_string(path, &value, "value")?;
    let response = value
        .get("configResponse")
        .cloned()
        .ok_or_else(|| invalid_fixture(path, "must contain a configResponse field"))?;
    if response
        .get("configOptions")
        .and_then(Value::as_array)
        .is_none()
    {
        return Err(invalid_fixture(
            path,
            "must contain configResponse.configOptions array",
        ));
    }
    if !response_contains_selected_current_value(&response, &config_id, &config_value) {
        return Err(invalid_fixture(
            path,
            "must include selected config currentValue",
        ));
    }
    Ok((
        session_id,
        config_id,
        config_value,
        SessionSetConfigOptionFixture { response },
    ))
}

fn response_contains_selected_current_value(
    response: &Value,
    config_id: &str,
    config_value: &str,
) -> bool {
    response
        .get("configOptions")
        .and_then(Value::as_array)
        .is_some_and(|options| {
            options.iter().any(|option| {
                option.get("id").and_then(Value::as_str) == Some(config_id)
                    && option.get("currentValue").and_then(Value::as_str) == Some(config_value)
            })
        })
}

fn required_request_string(path: &Path, value: &Value, field: &'static str) -> Result<String> {
    value
        .pointer(&format!("/configRequest/{field}"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_fixture(path, "must contain configRequest string fields"))
}

fn session_set_config_option_root(root: &Path, provider: ProviderId) -> std::path::PathBuf {
    root.join(provider.as_str())
        .join("session-set-config-option")
}
