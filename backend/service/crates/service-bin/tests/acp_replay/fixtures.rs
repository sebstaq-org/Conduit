//! Fixture discovery for the ACP replay integration test.

use super::support::{TestResult, read_json, service_root};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub(crate) struct ReplayProvider {
    pub(crate) id: &'static str,
    pub(crate) executable: &'static str,
}

pub(crate) struct ReplayFixture {
    pub(crate) provider_id: String,
    pub(crate) provider_executable: &'static str,
    pub(crate) path: PathBuf,
}

pub(crate) fn replay_fixtures() -> TestResult<Vec<ReplayFixture>> {
    if let Some(root) = std::env::var_os("CONDUIT_ACP_REPLAY_CANDIDATE_ROOT") {
        return candidate_replay_fixture(&PathBuf::from(root));
    }
    let mut fixtures = Vec::new();
    for provider in replay_providers() {
        for path in fixture_paths(provider.id)? {
            fixtures.push(ReplayFixture {
                provider_id: provider.id.to_owned(),
                provider_executable: provider.executable,
                path,
            });
        }
    }
    Ok(fixtures)
}

fn replay_providers() -> [ReplayProvider; 3] {
    [
        ReplayProvider {
            id: "codex",
            executable: "codex-acp",
        },
        ReplayProvider {
            id: "copilot",
            executable: "copilot",
        },
        ReplayProvider {
            id: "claude",
            executable: "claude-agent-acp",
        },
    ]
}

fn candidate_replay_fixture(root: &Path) -> TestResult<Vec<ReplayFixture>> {
    let scenario_path = if root.file_name().and_then(|name| name.to_str()) == Some("scenario.json")
    {
        root.to_path_buf()
    } else {
        root.join("scenario.json")
    };
    let scenario = read_json(&scenario_path)?;
    let provider_id = scenario
        .get("provider")
        .and_then(Value::as_str)
        .ok_or("candidate scenario was missing provider")?;
    let provider = replay_providers()
        .into_iter()
        .find(|provider| provider.id == provider_id)
        .ok_or_else(|| format!("unsupported candidate replay provider {provider_id}"))?;
    Ok(vec![ReplayFixture {
        provider_id: provider.id.to_owned(),
        provider_executable: provider.executable,
        path: scenario_path,
    }])
}

fn fixture_paths(provider: &str) -> TestResult<Vec<PathBuf>> {
    let replay_root = service_root()?.join(format!("testdata/providers/{provider}/replay"));
    let manifest = read_json(&replay_root.join("manifest.json"))?;
    manifest
        .get("scenarios")
        .and_then(Value::as_array)
        .ok_or("replay manifest was missing scenarios")?
        .iter()
        .map(|scenario| {
            let path = scenario
                .get("path")
                .and_then(Value::as_str)
                .ok_or("replay manifest scenario was missing path")?;
            Ok(replay_root.join(path))
        })
        .collect()
}
