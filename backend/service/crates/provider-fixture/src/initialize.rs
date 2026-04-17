use crate::{invalid_fixture, read_json};
use acp_core::{INITIALIZE_METHOD, ProviderInitializeResult};
use acp_discovery::ProviderId;
use service_runtime::{Result, RuntimeError};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub(crate) fn read_initialize_fixtures(
    root: &Path,
    provider: ProviderId,
    fixtures: &mut HashMap<ProviderId, ProviderInitializeResult>,
) -> Result<()> {
    let root = initialize_root(root, provider);
    if !root.exists() {
        return Ok(());
    }
    let entries = std::fs::read_dir(&root).map_err(|source| {
        RuntimeError::Provider(format!(
            "failed to read fixture directory {}: {source}",
            root.display()
        ))
    })?;
    for entry in entries {
        let entry = entry.map_err(|source| {
            RuntimeError::Provider(format!(
                "failed to read fixture directory {}: {source}",
                root.display()
            ))
        })?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let raw_path = path.join("provider.raw.json");
        if !raw_path.exists() {
            continue;
        }
        let fixture = read_initialize_fixture(&raw_path)?;
        if fixtures.insert(provider, fixture).is_some() {
            return Err(RuntimeError::Provider(format!(
                "duplicate initialize fixture for {}",
                provider.as_str()
            )));
        }
    }
    Ok(())
}

fn read_initialize_fixture(path: &Path) -> Result<ProviderInitializeResult> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    if value
        .pointer("/request/method")
        .and_then(serde_json::Value::as_str)
        != Some(INITIALIZE_METHOD)
    {
        return Err(invalid_fixture(
            path,
            "must contain request.method initialize",
        ));
    }
    serde_json::from_value(value).map_err(|source| {
        RuntimeError::Provider(format!(
            "invalid fixture {}: failed to decode initialize fixture: {source}",
            path.display()
        ))
    })
}

fn initialize_root(root: &Path, provider: ProviderId) -> PathBuf {
    root.join(provider.as_str()).join("initialize")
}
