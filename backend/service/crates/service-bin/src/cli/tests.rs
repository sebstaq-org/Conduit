//! Tests for service-bin CLI parsing.

use super::{Command, ReplayCommand, parse_command};
use crate::error::ServiceError;
use std::error::Error;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[test]
fn runtime_session_new_does_not_require_artifact_root() -> TestResult<()> {
    let args = strings(&[
        "runtime",
        "session/new",
        "--provider",
        "codex",
        "--cwd",
        "/repo",
        "--json",
    ]);
    let Command::Runtime { command } = parse_command(&args)? else {
        return Err("expected runtime command".into());
    };

    if command.command != "session/new" {
        return Err(format!("unexpected command {}", command.command).into());
    }
    if command.provider != "codex" {
        return Err(format!("unexpected provider {}", command.provider).into());
    }
    if command
        .params
        .get("cwd")
        .and_then(serde_json::Value::as_str)
        != Some("/repo")
    {
        return Err(format!("unexpected params {}", command.params).into());
    }
    Ok(())
}

#[test]
fn proof_session_new_still_requires_artifact_root() -> TestResult<()> {
    let args = strings(&["session-new", "--provider", "codex", "--cwd", "/repo"]);
    let error = parse_command(&args)
        .err()
        .ok_or("proof command unexpectedly parsed")?;
    if !matches!(error, ServiceError::MissingFlag { ref flag } if flag == "--artifact-root") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn consumer_proof_requires_artifact_root() -> TestResult<()> {
    let args = strings(&["consumer-proof", "--provider", "codex"]);
    let error = parse_command(&args)
        .err()
        .ok_or("consumer proof unexpectedly parsed")?;
    if !matches!(error, ServiceError::MissingFlag { ref flag } if flag == "--artifact-root") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn serve_defaults_to_product_websocket_port() -> TestResult<()> {
    let args = strings(&["serve"]);
    let Command::Serve { host, port } = parse_command(&args)? else {
        return Err("expected serve command".into());
    };
    if host != "127.0.0.1" {
        return Err(format!("unexpected host {host}").into());
    }
    if port != 4174 {
        return Err(format!("unexpected port {port}").into());
    }
    Ok(())
}

#[test]
fn replay_capture_accepts_default_manual_artifact_root() -> TestResult<()> {
    let args = strings(&[
        "replay",
        "capture",
        "--provider",
        "codex",
        "--scenario",
        "prompt-agent-text",
    ]);
    let Command::Replay {
        command:
            ReplayCommand::Capture {
                provider,
                scenario,
                artifact_root,
            },
    } = parse_command(&args)?
    else {
        return Err("expected replay capture command".into());
    };
    if provider.as_str() != "codex" || scenario != "prompt-agent-text" || artifact_root.is_some() {
        return Err("unexpected replay capture parse result".into());
    }
    Ok(())
}

#[test]
fn replay_curate_requires_raw_root() -> TestResult<()> {
    let args = strings(&["replay", "curate"]);
    let error = parse_command(&args)
        .err()
        .ok_or("replay curate unexpectedly parsed")?;
    if !matches!(error, ServiceError::MissingFlag { ref flag } if flag == "--raw-root") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
