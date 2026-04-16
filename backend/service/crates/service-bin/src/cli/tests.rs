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
fn consumer_proof_is_not_a_product_command() -> TestResult<()> {
    let args = strings(&["consumer-proof", "--provider", "codex"]);
    let error = parse_command(&args)
        .err()
        .ok_or("consumer proof unexpectedly parsed")?;
    if !matches!(error, ServiceError::UnsupportedCommand { ref command } if command == "consumer-proof")
    {
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
fn export_contracts_requires_output_path() -> TestResult<()> {
    let args = strings(&["export-contracts", "--out", "/tmp/contracts.json"]);
    let Command::ExportContracts { out } = parse_command(&args)? else {
        return Err("expected export-contracts command".into());
    };
    if out != std::path::Path::new("/tmp/contracts.json") {
        return Err(format!("unexpected output path {}", out.display()).into());
    }
    Ok(())
}

#[test]
fn replay_is_not_a_product_command() -> TestResult<()> {
    let args = strings(&["replay", "curate"]);
    let error = parse_command(&args)
        .err()
        .ok_or("replay curate unexpectedly parsed")?;
    if !matches!(error, ServiceError::UnsupportedCommand { ref command } if command == "replay") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
