//! Session scenarios for Phase 1 proof runs.

use crate::error::{Result, ServiceError};
use crate::proof::{ProofWorkspace, ScenarioCapture, write_capture};
use crate::support::{command_text, connect_proof_service, ensure_session};
use acp_discovery::ProviderId;
use agent_client_protocol_schema::ListSessionsResponse;
use std::path::{Path, PathBuf};
use std::time::Duration;

const RECOVERY_PROMPT: &str = "Reply with exactly RECOVERY_READY.";

struct SeededRecovery {
    service: app_api::AppService,
    session_id: String,
}

pub(crate) struct CancelRun<'a> {
    pub(crate) provider: ProviderId,
    pub(crate) prompt: &'a str,
    pub(crate) session_id: Option<String>,
    pub(crate) cancel_after_ms: u64,
    pub(crate) root: &'a Path,
    pub(crate) args: &'a [String],
}

/// Writes `session/new` artifacts for one provider.
pub(crate) fn run_session_new(
    provider: ProviderId,
    cwd: PathBuf,
    root: &Path,
    args: &[String],
) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let mut service = connect_proof_service(provider, &proof)?;
    let session_cwd = scenario_cwd(&proof, cwd);
    let response = service.new_session(session_cwd.clone())?;
    let capture = ScenarioCapture::from_service(service);
    write_capture(
        &command_text(args),
        &format!("session/new -> {}", response.session_id),
        &format!("Session cwd: `{}`\n", session_cwd.display()),
        &proof,
        &capture,
    )
}

/// Writes `session/list` artifacts for one provider.
pub(crate) fn run_session_list(provider: ProviderId, root: &Path, args: &[String]) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let mut service = connect_proof_service(provider, &proof)?;
    let seed = service.new_session(proof.cwd())?;
    let response = service.list_sessions()?;
    let capture = ScenarioCapture::from_service(service);
    write_capture(
        &command_text(args),
        &format!("session/list -> {} sessions", response.sessions.len()),
        &format!("Seed session id: `{}`\n", seed.session_id),
        &proof,
        &capture,
    )
}

/// Writes `session/load` artifacts for one provider.
pub(crate) fn run_session_load(
    provider: ProviderId,
    cwd: PathBuf,
    session_id: &Option<String>,
    root: &Path,
    args: &[String],
) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let seed = seed_recovery_session(provider, &proof, cwd)?;
    let seed_capture = ScenarioCapture::from_service(seed.service);
    let mut service = connect_proof_service(provider, &proof)?;
    let list = service.list_sessions()?;
    let load_id =
        select_recoverable_session(&list, &proof, session_id.as_deref(), &seed.session_id)?;
    service.load_session(load_id.clone(), proof.cwd())?;
    let merged =
        ScenarioCapture::merge(vec![seed_capture, ScenarioCapture::from_service(service)])?;
    write_capture(
        &command_text(args),
        &format!("session/load -> {load_id}"),
        &format!(
            "Seed session id: `{}`\n\nRecovery list count: `{}`\n",
            seed.session_id,
            list.sessions.len()
        ),
        &proof,
        &merged,
    )
}

/// Writes restart-recovery artifacts for one provider.
pub(crate) fn run_restart_recovery(
    provider: ProviderId,
    cwd: PathBuf,
    session_id: &Option<String>,
    root: &Path,
    args: &[String],
) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let seed = seed_recovery_session(provider, &proof, cwd)?;
    let seed_capture = ScenarioCapture::from_service(seed.service);
    let mut service = connect_proof_service(provider, &proof)?;
    let list = service.list_sessions()?;
    let load_id =
        select_recoverable_session(&list, &proof, session_id.as_deref(), &seed.session_id)?;
    service.load_session(load_id.clone(), proof.cwd())?;
    let merged =
        ScenarioCapture::merge(vec![seed_capture, ScenarioCapture::from_service(service)])?;
    write_capture(
        &command_text(args),
        &format!("restart-recovery -> {load_id}"),
        &format!(
            "Recovery chain: `initialize -> session/list -> session/load`\n\nSeed session id: `{}`\n\nRecovery list count: `{}`\n",
            seed.session_id,
            list.sessions.len()
        ),
        &proof,
        &merged,
    )
}

/// Writes `session/prompt` artifacts for one provider.
pub(crate) fn run_session_prompt(
    provider: ProviderId,
    prompt: &str,
    session_id: Option<String>,
    root: &Path,
    args: &[String],
) -> Result<()> {
    let proof = ProofWorkspace::prepare(provider, root)?;
    let mut service = connect_proof_service(provider, &proof)?;
    let session_id = ensure_session(&mut service, proof.cwd(), session_id)?;
    let response = service.prompt_text(&session_id, prompt)?;
    let capture = ScenarioCapture::from_service(service);
    write_capture(
        &command_text(args),
        &format!(
            "session/prompt -> {} ({:?})",
            session_id, response.stop_reason
        ),
        "",
        &proof,
        &capture,
    )
}

/// Writes `session/cancel` artifacts for one provider.
pub(crate) fn run_session_cancel(input: CancelRun<'_>) -> Result<()> {
    let proof = ProofWorkspace::prepare(input.provider, input.root)?;
    let mut service = connect_proof_service(input.provider, &proof)?;
    let session_id = ensure_session(&mut service, proof.cwd(), input.session_id)?;
    let response = service.prompt_text_with_cancel(
        &session_id,
        input.prompt,
        Duration::from_millis(input.cancel_after_ms),
    )?;
    let capture = ScenarioCapture::from_service(service);
    write_capture(
        &command_text(input.args),
        &format!(
            "session/cancel -> {} ({:?})",
            session_id, response.stop_reason
        ),
        &format!("Cancel scheduled after: `{}` ms\n", input.cancel_after_ms),
        &proof,
        &capture,
    )
}

fn seed_recovery_session(
    provider: ProviderId,
    proof: &ProofWorkspace,
    cwd: PathBuf,
) -> Result<SeededRecovery> {
    let mut service = connect_proof_service(provider, proof)?;
    let response = service.new_session(scenario_cwd(proof, cwd))?;
    let session_id = response.session_id.to_string();
    let _ = service.prompt_text(&session_id, RECOVERY_PROMPT)?;
    service.disconnect_provider();
    Ok(SeededRecovery {
        service,
        session_id,
    })
}

fn select_recoverable_session(
    list: &ListSessionsResponse,
    proof: &ProofWorkspace,
    requested_session_id: Option<&str>,
    seeded_session_id: &str,
) -> Result<String> {
    if let Some(requested) = requested_session_id
        && list
            .sessions
            .iter()
            .any(|session| session.session_id.to_string() == requested)
    {
        return Ok(requested.to_owned());
    }
    if let Some(session) = list
        .sessions
        .iter()
        .find(|session| session.cwd == proof.cwd())
    {
        return Ok(session.session_id.to_string());
    }
    if let Some(session) = list
        .sessions
        .iter()
        .find(|session| session.session_id.to_string() == seeded_session_id)
    {
        return Ok(session.session_id.to_string());
    }
    Err(ServiceError::InvalidCapture {
        message: format!(
            "no recoverable session from list matched proof cwd {}",
            proof.cwd().display()
        ),
    })
}

fn scenario_cwd(proof: &ProofWorkspace, requested: PathBuf) -> PathBuf {
    if requested.starts_with(proof.cwd()) {
        requested
    } else {
        proof.cwd()
    }
}
