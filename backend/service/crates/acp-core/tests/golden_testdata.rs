//! Regression tests for normalized golden proof fixtures.

use acp_contracts as _;
use acp_core::{LiveSessionSnapshot, PromptLifecycleSnapshot, ProviderSnapshot};
use acp_discovery as _;
use agent_client_protocol_schema as _;
use serde as _;
use std::error::Error;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use thiserror as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[test]
fn golden_provider_snapshots_deserialize() -> TestResult<()> {
    for provider in ["claude", "copilot", "codex"] {
        let snapshot: ProviderSnapshot = read_json(&format!("{provider}-provider-snapshot.json"))?;
        if snapshot.provider.as_str() != provider {
            return Err(format!("{provider} snapshot has wrong provider").into());
        }
    }
    Ok(())
}

#[test]
fn golden_prompt_lifecycles_deserialize() -> TestResult<()> {
    for provider in ["claude", "copilot", "codex"] {
        let lifecycle: PromptLifecycleSnapshot =
            read_json(&format!("{provider}-prompt-lifecycle.json"))?;
        if lifecycle.identity.provider.as_str() != provider {
            return Err(format!("{provider} prompt lifecycle has wrong provider").into());
        }
    }
    Ok(())
}

#[test]
fn golden_session_lists_deserialize() -> TestResult<()> {
    for provider in ["claude", "copilot", "codex"] {
        let sessions: Vec<LiveSessionSnapshot> =
            read_json(&format!("{provider}-session-list.json"))?;
        if sessions.is_empty() {
            return Err(format!("{provider} session-list golden is empty").into());
        }
    }
    Ok(())
}

fn read_json<T>(file_name: &str) -> TestResult<T>
where
    T: serde::de::DeserializeOwned,
{
    let path = testdata_root()?.join("golden").join(file_name);
    let contents = read_to_string(path)?;
    Ok(serde_json::from_str(&contents)?)
}

fn testdata_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(service_root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(service_root.join("testdata"))
}
