//! Minimal argument parsing for silent Phase 1 proof commands.

use crate::error::{Result, ServiceError};
use acp_discovery::ProviderId;
use std::path::PathBuf;
use std::str::FromStr;

/// The supported silent proof commands.
pub(crate) enum Command {
    /// Writes Part 1 contract lock artifacts.
    Contracts {
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes discovery artifacts for one provider.
    Discovery {
        /// The provider being probed.
        provider: ProviderId,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes initialize artifacts for one provider.
    Initialize {
        /// The provider being initialized.
        provider: ProviderId,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes session/new artifacts for one provider.
    SessionNew {
        /// The provider being used.
        provider: ProviderId,
        /// The working directory requested from ACP.
        cwd: PathBuf,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes session/list artifacts for one provider.
    SessionList {
        /// The provider being used.
        provider: ProviderId,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes session/load artifacts for one provider.
    SessionLoad {
        /// The provider being used.
        provider: ProviderId,
        /// The working directory used for loading.
        cwd: PathBuf,
        /// The optional ACP session id to load.
        session_id: Option<String>,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes restart recovery artifacts for one provider.
    RestartRecovery {
        /// The provider being used.
        provider: ProviderId,
        /// The working directory used for loading.
        cwd: PathBuf,
        /// The optional ACP session id to recover.
        session_id: Option<String>,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes session/prompt artifacts for one provider.
    SessionPrompt {
        /// The provider being used.
        provider: ProviderId,
        /// The text prompt to send.
        prompt: String,
        /// Optional ACP session id to reuse.
        session_id: Option<String>,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
    /// Writes session/cancel artifacts for one provider.
    SessionCancel {
        /// The provider being used.
        provider: ProviderId,
        /// The text prompt to send before cancellation.
        prompt: String,
        /// Optional ACP session id to reuse.
        session_id: Option<String>,
        /// Delay before `session/cancel`.
        cancel_after_ms: u64,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
}

/// Parses the silent proof CLI arguments.
pub(crate) fn parse_command(args: &[String]) -> Result<Command> {
    let Some(command) = args.first() else {
        return Err(unsupported("missing command"));
    };
    match command.as_str() {
        "contracts" => Ok(Command::Contracts {
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "discovery" => Ok(Command::Discovery {
            provider: required_provider(args, "--provider")?,
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "initialize" => Ok(Command::Initialize {
            provider: required_provider(args, "--provider")?,
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "session-new" => Ok(Command::SessionNew {
            provider: required_provider(args, "--provider")?,
            cwd: required_path(args, "--cwd")?,
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "session-list" => Ok(Command::SessionList {
            provider: required_provider(args, "--provider")?,
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "session-load" => Ok(Command::SessionLoad {
            provider: required_provider(args, "--provider")?,
            cwd: required_path(args, "--cwd")?,
            session_id: optional_value(args, "--session-id"),
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "restart-recovery" => Ok(Command::RestartRecovery {
            provider: required_provider(args, "--provider")?,
            cwd: required_path(args, "--cwd")?,
            session_id: optional_value(args, "--session-id"),
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "session-prompt" => Ok(Command::SessionPrompt {
            provider: required_provider(args, "--provider")?,
            artifact_root: required_path(args, "--artifact-root")?,
            prompt: required_value(args, "--prompt")?,
            session_id: optional_value(args, "--session-id"),
        }),
        "session-cancel" => {
            let _proof_cwd = required_path(args, "--cwd")?;
            Ok(Command::SessionCancel {
                provider: required_provider(args, "--provider")?,
                prompt: required_value(args, "--prompt")?,
                session_id: optional_value(args, "--session-id"),
                cancel_after_ms: required_u64(args, "--cancel-after-ms")?,
                artifact_root: required_path(args, "--artifact-root")?,
            })
        }
        _ => Err(unsupported(command)),
    }
}

fn required_provider(args: &[String], flag: &str) -> Result<ProviderId> {
    let value = required_value(args, flag)?;
    ProviderId::from_str(&value).map_err(|message| ServiceError::InvalidProvider {
        provider: value,
        message: message.to_owned(),
    })
}

fn required_path(args: &[String], flag: &str) -> Result<PathBuf> {
    Ok(PathBuf::from(required_value(args, flag)?))
}

fn required_u64(args: &[String], flag: &str) -> Result<u64> {
    let value = required_value(args, flag)?;
    value
        .parse::<u64>()
        .map_err(|source| ServiceError::InvalidFlagValue {
            flag: flag.to_owned(),
            value,
            message: source.to_string(),
        })
}

fn required_value(args: &[String], flag: &str) -> Result<String> {
    optional_value(args, flag).ok_or_else(|| missing(flag))
}

fn optional_value(args: &[String], flag: &str) -> Option<String> {
    args.windows(2)
        .find(|window| window[0] == flag)
        .map(|window| window[1].clone())
}

fn missing(flag: &str) -> ServiceError {
    ServiceError::MissingFlag {
        flag: flag.to_owned(),
    }
}

fn unsupported(command: &str) -> ServiceError {
    ServiceError::UnsupportedCommand {
        command: command.to_owned(),
    }
}
