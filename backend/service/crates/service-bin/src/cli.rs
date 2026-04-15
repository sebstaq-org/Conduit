//! Minimal argument parsing for product service commands.

use crate::error::{Result, ServiceError};
use serde_json::{Value, json};
use service_runtime::ConsumerCommand;

/// The supported service commands.
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
}

/// Parses service CLI arguments.
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
        | "provider/disconnect"
        | "sessions/watch"
        | "settings/get" => Ok(json!({})),
        "session/new" => Ok(json!({
            "cwd": required_value(args, "--cwd")?,
        })),
        "session/load" => Ok(json!({
            "session_id": required_value(args, "--session-id")?,
            "cwd": required_value(args, "--cwd")?,
        })),
        "session/open" => Ok(json!({
            "sessionId": required_value(args, "--session-id")?,
            "cwd": required_value(args, "--cwd")?,
        })),
        "session/set_config_option" => Ok(json!({
            "sessionId": required_value(args, "--session-id")?,
            "configId": required_value(args, "--config-id")?,
            "value": required_value(args, "--value")?,
        })),
        "session/history" => Ok(json!({
            "openSessionId": required_value(args, "--open-session-id")?,
        })),
        "session/watch" => Ok(json!({
            "openSessionId": required_value(args, "--open-session-id")?,
        })),
        "session/prompt" => Ok(json!({
            "openSessionId": required_value(args, "--open-session-id")?,
            "prompt": [{ "type": "text", "text": required_value(args, "--prompt")? }],
        })),
        "session/cancel" => Ok(json!({ "session_id": required_value(args, "--session-id")? })),
        "settings/update" => Ok(json!({
            "sessionGroupsUpdatedWithinDays": settings_lookback_value(args)?
        })),
        _ => Err(unsupported(command)),
    }
}

fn settings_lookback_value(args: &[String]) -> Result<Value> {
    if args.iter().any(|arg| arg == "--all-history") {
        return Ok(Value::Null);
    }
    let raw = required_value(args, "--updated-within-days")?;
    let parsed = raw
        .parse::<u64>()
        .map_err(|source| ServiceError::InvalidFlagValue {
            flag: "--updated-within-days".to_owned(),
            value: raw.clone(),
            message: source.to_string(),
        })?;
    Ok(Value::from(parsed))
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
