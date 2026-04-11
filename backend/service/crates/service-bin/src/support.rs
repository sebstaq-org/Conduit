//! Shared helpers for silent proof command execution.

use crate::error::Result;
use crate::proof::ProofWorkspace;
use acp_discovery::ProviderId;
use app_api::AppService;
use std::path::PathBuf;

/// Connects one provider inside an isolated proof workspace.
///
/// # Errors
///
/// Returns an error when the provider cannot be started or initialized inside
/// the supplied proof workspace.
pub(crate) fn connect_proof_service(
    provider: ProviderId,
    proof: &ProofWorkspace,
) -> Result<AppService> {
    Ok(AppService::connect_provider_with_environment(
        provider,
        proof.environment(),
    )?)
}

/// Ensures a live session exists, loading or creating as needed.
pub(crate) fn ensure_session(
    service: &mut AppService,
    cwd: PathBuf,
    session_id: Option<String>,
) -> Result<String> {
    if let Some(session_id) = session_id {
        service.load_session(session_id.clone(), cwd)?;
        return Ok(session_id);
    }
    let response = service.new_session(cwd)?;
    Ok(response.session_id.to_string())
}

/// Formats the exact command used for one artifact.
pub(crate) fn command_text(args: &[String]) -> String {
    let joined = args.join(" ");
    format!(
        "rtk cargo run --quiet --locked --manifest-path backend/service/Cargo.toml -p service-bin -- {joined}"
    )
}
