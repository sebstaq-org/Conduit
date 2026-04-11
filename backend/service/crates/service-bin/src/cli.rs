//! Minimal argument parsing for silent Phase 1 proof commands.

use crate::error::{Result, ServiceError};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::ConsumerCommand;
use std::path::PathBuf;
use std::str::FromStr;

/// The supported silent proof commands.
pub(crate) enum Command {
    /// Runs the normal product WebSocket service boundary.
    Serve {
        /// Host interface to bind.
        host: String,
        /// TCP port to bind.
        port: u16,
    },
    /// Runs one normal runtime consumer command and writes JSON to stdout.
    Runtime {
        /// The runtime command envelope.
        command: ConsumerCommand,
    },
    /// Runs one consumer API proof sequence and writes artifacts.
    ConsumerProof {
        /// The provider being used.
        provider: ProviderId,
        /// The artifact root to populate.
        artifact_root: PathBuf,
    },
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
    /// Runs the dev-only ACP replay fixture workflow.
    Replay {
        /// The replay workflow subcommand.
        command: ReplayCommand,
    },
}

/// Dev-only replay fixture workflow subcommands.
pub(crate) enum ReplayCommand {
    /// Captures live observation frames into ignored manual artifacts.
    Capture {
        /// The provider being captured.
        provider: ProviderId,
        /// The replay scenario name.
        scenario: String,
        /// Optional raw artifact root override.
        artifact_root: Option<PathBuf>,
    },
    /// Curates one raw capture into candidate replay fixture files.
    Curate {
        /// Raw capture root to read.
        raw_root: PathBuf,
        /// Optional candidate output root override.
        candidate_root: Option<PathBuf>,
    },
    /// Promotes one reviewed candidate into committed replay testdata.
    Promote {
        /// Candidate fixture root to promote.
        candidate_root: PathBuf,
        /// Optional service testdata root override.
        testdata_root: Option<PathBuf>,
    },
}

/// Parses the silent proof CLI arguments.
pub(crate) fn parse_command(args: &[String]) -> Result<Command> {
    let Some(command) = args.first() else {
        return Err(unsupported("missing command"));
    };
    match command.as_str() {
        "serve" => Ok(Command::Serve {
            host: optional_value(args, "--host").unwrap_or_else(|| "127.0.0.1".to_owned()),
            port: optional_u16(args, "--port")?.unwrap_or(4174),
        }),
        "runtime" => Ok(Command::Runtime {
            command: runtime_command(args)?,
        }),
        "consumer-proof" => Ok(Command::ConsumerProof {
            provider: required_provider(args, "--provider")?,
            artifact_root: required_path(args, "--artifact-root")?,
        }),
        "replay" => parse_replay_command(args),
        _ => parse_proof_command(command, args),
    }
}

fn parse_replay_command(args: &[String]) -> Result<Command> {
    let Some(action) = args.get(1) else {
        return Err(missing("<replay-command>"));
    };
    let command = match action.as_str() {
        "capture" => ReplayCommand::Capture {
            provider: required_provider(args, "--provider")?,
            scenario: required_value(args, "--scenario")?,
            artifact_root: optional_path(args, "--artifact-root"),
        },
        "curate" => ReplayCommand::Curate {
            raw_root: required_path(args, "--raw-root")?,
            candidate_root: optional_path(args, "--candidate-root"),
        },
        "promote" => ReplayCommand::Promote {
            candidate_root: required_path(args, "--candidate-root")?,
            testdata_root: optional_path(args, "--testdata-root"),
        },
        _ => return Err(unsupported(action)),
    };
    Ok(Command::Replay { command })
}

fn parse_proof_command(command: &str, args: &[String]) -> Result<Command> {
    match command {
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

fn runtime_command(args: &[String]) -> Result<ConsumerCommand> {
    let Some(command) = args.get(1) else {
        return Err(missing("<runtime-command>"));
    };
    require_flag(args, "--json")?;
    let provider = required_value(args, "--provider")?;
    let params = runtime_params(command, args)?;
    Ok(ConsumerCommand {
        id: optional_value(args, "--id").unwrap_or_else(|| "runtime-1".to_owned()),
        command: command.to_owned(),
        provider,
        params,
    })
}

fn runtime_params(command: &str, args: &[String]) -> Result<Value> {
    match command {
        "initialize"
        | "session/list"
        | "snapshot/get"
        | "provider/disconnect"
        | "events/subscribe" => Ok(json!({})),
        "session/new" => Ok(json!({
            "cwd": required_value(args, "--cwd")?,
        })),
        "session/load" => Ok(json!({
            "session_id": required_value(args, "--session-id")?,
            "cwd": required_value(args, "--cwd")?,
        })),
        "session/prompt" => Ok(json!({
            "session_id": required_value(args, "--session-id")?,
            "prompt": required_value(args, "--prompt")?,
        })),
        "session/cancel" => Ok(json!({
            "session_id": required_value(args, "--session-id")?,
        })),
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

fn optional_path(args: &[String], flag: &str) -> Option<PathBuf> {
    optional_value(args, flag).map(PathBuf::from)
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

fn optional_u16(args: &[String], flag: &str) -> Result<Option<u16>> {
    let Some(value) = optional_value(args, flag) else {
        return Ok(None);
    };
    value
        .parse::<u16>()
        .map(Some)
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

fn require_flag(args: &[String], flag: &str) -> Result<()> {
    if args.iter().any(|arg| arg == flag) {
        return Ok(());
    }
    Err(missing(flag))
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

#[cfg(test)]
mod tests;
