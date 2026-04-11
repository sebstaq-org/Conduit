//! Discovery and initialize artifact scenarios.

use crate::artifact::{DiscoveryArtifact, write_discovery_artifacts};
use crate::error::Result;
use crate::proof::{ProofWorkspace, ScenarioCapture, verify_discovery_capture, write_capture};
use crate::support::{command_text, connect_proof_service};
use acp_discovery::{ProviderId, discover_provider_with_environment};
use std::path::Path;

/// Writes discovery artifacts for one provider.
///
/// # Errors
///
/// Returns an error when discovery fails, the proof workspace cannot be
/// prepared, or artifact writing fails.
pub(crate) fn run_discovery(provider: ProviderId, root: &Path, args: &[String]) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let discovery = discover_provider_with_environment(provider, proof.environment())?;
    verify_discovery_capture("discovery", &proof, &discovery)?;
    let summary = format!(
        "# Discovery\n\n{}\nProvider: `{}`\n\nVersion: `{}`\n\nInitialize viable: `{}`\n\nInitialize elapsed: `{}` ms\n",
        proof.summary_lines(),
        provider.as_str(),
        discovery.version,
        discovery.initialize_viable,
        discovery.initialize_probe.elapsed_ms
    );
    let command = command_text(args);
    let stdout_text = discovery.initialize_probe.stdout_lines.join("\n");
    let stderr_text = discovery.initialize_probe.stderr_lines.join("\n");
    write_discovery_artifacts(
        root,
        DiscoveryArtifact {
            command: &command,
            summary: &summary,
            path_text: &discovery.resolved_path,
            version_text: &discovery.version,
            stdout_text: &stdout_text,
            stderr_text: &stderr_text,
        },
    )
}

/// Writes initialize artifacts for one provider.
///
/// # Errors
///
/// Returns an error when the provider cannot be connected or artifacts cannot
/// be written.
pub(crate) fn run_initialize(provider: ProviderId, root: &Path, args: &[String]) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let service = connect_proof_service(provider, &proof)?;
    let capture = ScenarioCapture::from_service(service);
    write_capture(&command_text(args), "initialize", "", &proof, &capture)
}
