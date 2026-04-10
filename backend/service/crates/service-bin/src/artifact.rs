//! Artifact writers for Phase 1 proof commands.

use crate::error::{Result, ServiceError};
use acp_core::{ProviderSnapshot, RawWireEvent, WireKind, WireStream};
use serde_json::Value;
use std::fs::{create_dir_all, write};
use std::path::Path;

/// One complete scenario artifact payload.
pub(crate) struct ScenarioArtifact<'a> {
    /// The command text to record.
    pub command: &'a str,
    /// The markdown summary to write.
    pub summary: &'a str,
    /// The current provider snapshot.
    pub snapshot: &'a ProviderSnapshot,
    /// The outbound ACP envelopes.
    pub requests: &'a [Value],
    /// The inbound ACP responses.
    pub responses: &'a [Value],
    /// The raw wire events.
    pub events: &'a [RawWireEvent],
}

/// Discovery-specific artifact payload.
pub(crate) struct DiscoveryArtifact<'a> {
    /// The command text to record.
    pub command: &'a str,
    /// The markdown summary to write.
    pub summary: &'a str,
    /// The resolved binary path.
    pub path_text: &'a str,
    /// The resolved version text.
    pub version_text: &'a str,
    /// The captured stdout payload.
    pub stdout_text: &'a str,
    /// The captured stderr payload.
    pub stderr_text: &'a str,
}

/// Writes the generic Phase 1 scenario files.
pub(crate) fn write_scenario_artifacts(root: &Path, artifact: ScenarioArtifact<'_>) -> Result<()> {
    create_dir_all(root).map_err(|source| write_error(root, source))?;
    write_text(root.join("command.txt"), artifact.command)?;
    write_text(root.join("summary.md"), artifact.summary)?;
    write_json(root.join("snapshot.json"), artifact.snapshot)?;
    write_jsonl(root.join("requests.jsonl"), artifact.requests)?;
    write_jsonl(root.join("responses.jsonl"), artifact.responses)?;
    write_jsonl(root.join("events.jsonl"), artifact.events)?;
    write_text(root.join("stdout.log"), &stdout_log(artifact.events))?;
    write_text(root.join("stderr.log"), &stderr_log(artifact.events))?;
    Ok(())
}

/// Writes the discovery-specific artifact files.
pub(crate) fn write_discovery_artifacts(
    root: &Path,
    artifact: DiscoveryArtifact<'_>,
) -> Result<()> {
    create_dir_all(root).map_err(|source| write_error(root, source))?;
    write_text(root.join("command.txt"), artifact.command)?;
    write_text(root.join("summary.md"), artifact.summary)?;
    write_text(root.join("path.txt"), artifact.path_text)?;
    write_text(root.join("version.txt"), artifact.version_text)?;
    write_text(root.join("stdout.log"), artifact.stdout_text)?;
    write_text(root.join("stderr.log"), artifact.stderr_text)?;
    Ok(())
}

/// Writes the contract-lock artifact files.
pub(crate) fn write_contract_artifacts(
    root: &Path,
    command: &str,
    summary: &str,
    manifest_copy: &str,
    schema_meta_check: &str,
) -> Result<()> {
    create_dir_all(root).map_err(|source| write_error(root, source))?;
    write_text(root.join("command.txt"), command)?;
    write_text(root.join("summary.md"), summary)?;
    write_text(root.join("manifest-copy.txt"), manifest_copy)?;
    write_text(root.join("schema-meta-check.txt"), schema_meta_check)?;
    Ok(())
}

fn write_json(path: impl AsRef<Path>, value: &impl serde::Serialize) -> Result<()> {
    let data = serde_json::to_string_pretty(value)?;
    write_text(path, &data)
}

fn write_jsonl(path: impl AsRef<Path>, values: &[impl serde::Serialize]) -> Result<()> {
    let mut lines = Vec::with_capacity(values.len());
    for value in values {
        lines.push(serde_json::to_string(value)?);
    }
    write_text(path, &lines.join("\n"))
}

fn write_text(path: impl AsRef<Path>, contents: &str) -> Result<()> {
    let path = path.as_ref();
    write(path, contents).map_err(|source| write_error(path, source))
}

fn stdout_log(events: &[RawWireEvent]) -> String {
    events
        .iter()
        .filter(|event| event.stream == WireStream::Incoming && event.kind != WireKind::Diagnostic)
        .map(|event| event.payload.clone())
        .collect::<Vec<_>>()
        .join("\n")
}

fn stderr_log(events: &[RawWireEvent]) -> String {
    events
        .iter()
        .filter(|event| event.stream == WireStream::Stderr)
        .map(|event| event.payload.clone())
        .collect::<Vec<_>>()
        .join("\n")
}

fn write_error(path: &Path, source: std::io::Error) -> ServiceError {
    ServiceError::WriteArtifact {
        path: path.to_path_buf(),
        source,
    }
}
