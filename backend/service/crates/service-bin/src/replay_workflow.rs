//! Dev-only capture, curation, and promotion for ACP replay fixtures.

mod capture;
mod curate;
mod promote;

use crate::cli::ReplayCommand;
use crate::error::{Result, ServiceError};
use acp_discovery::ProviderId;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use std::process::Command as ProcessCommand;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_ROOT: &str = "artifacts/manual/phase-2.2/replay";
const TESTDATA_REPLAY_SEGMENT: &str = "backend/service/testdata/providers";
const REPLAY_WORKFLOW_SCHEMA: &str = "conduit.acp_replay.workflow.v1";
const REPLAY_SCENARIO_SCHEMA: &str = "conduit.acp_replay.scenario.v1";
const REPLAY_MANIFEST_SCHEMA: &str = "conduit.acp_replay.manifest.v1";

/// Runs one replay fixture workflow subcommand.
///
/// # Errors
///
/// Returns an error when capture, curation, promotion, or fixture validation
/// fails.
pub(crate) async fn run(command: ReplayCommand, args: &[String]) -> Result<()> {
    match command {
        ReplayCommand::Capture {
            provider,
            scenario,
            artifact_root,
        } => capture::capture(provider, &scenario, artifact_root, args).await,
        ReplayCommand::Curate {
            raw_root,
            candidate_root,
        } => curate::curate(&raw_root, candidate_root),
        ReplayCommand::Promote {
            candidate_root,
            testdata_root,
        } => promote::promote(&candidate_root, testdata_root),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReplayMetadata {
    schema: String,
    provider: ProviderId,
    scenario: String,
    cwd: String,
    capture_id: String,
    raw_capture_safe_to_promote: bool,
    curated_replay_safe_to_promote: bool,
    command: String,
    blockers: Vec<String>,
}

fn read_metadata(path: &Path) -> Result<ReplayMetadata> {
    serde_json::from_str(&read_to_string(path)?).map_err(ServiceError::from)
}

fn read_json(path: &Path) -> Result<Value> {
    serde_json::from_str(&read_to_string(path)?).map_err(ServiceError::from)
}

fn read_jsonl(path: &Path) -> Result<Vec<Value>> {
    read_to_string(path)?
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).map_err(ServiceError::from))
        .collect()
}

fn scenario_string<'a>(scenario: &'a Value, key: &str) -> Result<&'a str> {
    scenario
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| invalid_capture(&format!("scenario missing {key}")))
}

fn default_raw_root(provider: ProviderId, scenario: &str) -> PathBuf {
    Path::new(DEFAULT_ROOT)
        .join("raw")
        .join(provider.as_str())
        .join(scenario)
}

fn default_candidate_root(provider: ProviderId, scenario: &str) -> PathBuf {
    Path::new(DEFAULT_ROOT)
        .join("candidates")
        .join(provider.as_str())
        .join(scenario)
}

fn service_testdata_root() -> PathBuf {
    service_root().join("testdata")
}

fn service_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("backend/service"))
}

fn run_replay_oracle_gate(candidate_root: Option<&Path>) -> Result<()> {
    let service_root = service_root();
    let mut command = ProcessCommand::new("rtk");
    command
        .arg("cargo")
        .arg("test")
        .arg("--manifest-path")
        .arg(service_root.join("Cargo.toml"))
        .arg("-p")
        .arg("service-bin")
        .arg("--test")
        .arg("acp_replay");
    if let Some(root) = candidate_root {
        command.env("CONDUIT_ACP_REPLAY_CANDIDATE_ROOT", root.canonicalize()?);
    }
    let status = command.status()?;
    if status.success() {
        return Ok(());
    }
    Err(invalid_capture("replay oracle gate failed"))
}

fn capture_id(provider: ProviderId, scenario: &str) -> Result<String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| invalid_capture(&format!("system time before UNIX epoch: {error}")))?
        .as_secs();
    Ok(format!("{}-{}-{timestamp}", provider.as_str(), scenario))
}

fn guard_not_committed_replay_root(path: &Path) -> Result<()> {
    let display = path.display().to_string();
    if display.contains(TESTDATA_REPLAY_SEGMENT) {
        return Err(invalid_capture(
            "raw or candidate replay output must stay outside backend/service/testdata/providers",
        ));
    }
    Ok(())
}

fn invalid_capture(message: &str) -> ServiceError {
    ServiceError::InvalidCapture {
        message: message.to_owned(),
    }
}
