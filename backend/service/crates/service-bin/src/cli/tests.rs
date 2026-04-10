//! Tests for service-bin CLI parsing.

use super::{Command, parse_command};
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

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
