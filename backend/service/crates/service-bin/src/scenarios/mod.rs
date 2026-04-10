//! Scenario command dispatch for Phase 1 proof runs.

mod contracts;
mod discovery;
mod sessions;

use crate::cli::Command;
use crate::error::{Result, ServiceError};

/// Runs one parsed proof command.
///
/// # Errors
///
/// Returns an error when the selected scenario fails.
pub(crate) fn run(command: Command, args: &[String]) -> Result<()> {
    match command {
        Command::Runtime { .. } => Err(ServiceError::InvalidCapture {
            message: "runtime commands must be handled outside proof scenarios".to_owned(),
        }),
        Command::Contracts { artifact_root } => contracts::run(&artifact_root, args),
        Command::Discovery {
            provider,
            artifact_root,
        } => discovery::run_discovery(provider, &artifact_root, args),
        Command::Initialize {
            provider,
            artifact_root,
        } => discovery::run_initialize(provider, &artifact_root, args),
        Command::SessionNew {
            provider,
            cwd,
            artifact_root,
        } => sessions::run_session_new(provider, cwd, &artifact_root, args),
        Command::SessionList {
            provider,
            artifact_root,
        } => sessions::run_session_list(provider, &artifact_root, args),
        Command::SessionLoad {
            provider,
            cwd,
            session_id,
            artifact_root,
        } => sessions::run_session_load(provider, cwd, &session_id, &artifact_root, args),
        Command::RestartRecovery {
            provider,
            cwd,
            session_id,
            artifact_root,
        } => sessions::run_restart_recovery(provider, cwd, &session_id, &artifact_root, args),
        Command::SessionPrompt {
            provider,
            prompt,
            session_id,
            artifact_root,
        } => sessions::run_session_prompt(provider, &prompt, session_id, &artifact_root, args),
        Command::SessionCancel {
            provider,
            prompt,
            session_id,
            cancel_after_ms,
            artifact_root,
        } => sessions::run_session_cancel(sessions::CancelRun {
            provider,
            prompt: &prompt,
            session_id,
            cancel_after_ms,
            root: &artifact_root,
            args,
        }),
    }
}
