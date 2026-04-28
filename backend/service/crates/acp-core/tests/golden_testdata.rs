//! Regression tests for normalized golden proof fixtures.

use acp_contracts as _;
use acp_core::{LiveSessionSnapshot, PromptLifecycleSnapshot, ProviderSnapshot};
use acp_discovery as _;
use agent_client_protocol as _;
use schemars as _;
use serde as _;
use std::error::Error;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use thiserror as _;
use tokio as _;
use tokio_util as _;
use tracing as _;

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
    Ok(repo_root()?.join("backend/service/testdata"))
}

fn repo_root() -> TestResult<PathBuf> {
    let cwd = std::env::current_dir()?;
    if let Some(root) = discover_repo_root(&cwd) {
        return Ok(root);
    }

    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    discover_repo_root(manifest_dir).ok_or_else(|| "could not resolve repository root".into())
}

fn discover_repo_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|candidate| {
            candidate.join("package.json").is_file()
                && candidate.join("backend/service/Cargo.toml").is_file()
        })
        .map(Path::to_path_buf)
}
