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
fn runtime_session_respond_interaction_accepts_response_json() -> TestResult<()> {
    let args = strings(&[
        "runtime",
        "session/respond_interaction",
        "--provider",
        "all",
        "--open-session-id",
        "open-session-1",
        "--interaction-id",
        "interaction-1",
        "--response-json",
        "{\"kind\":\"selected\",\"optionId\":\"answer-0\"}",
        "--json",
    ]);
    let Command::Runtime { command } = parse_command(&args)? else {
        return Err("expected runtime command".into());
    };

    if command.command != "session/respond_interaction" {
        return Err(format!("unexpected command {}", command.command).into());
    }
    if command.provider != "all" {
        return Err(format!("unexpected provider {}", command.provider).into());
    }
    if command
        .params
        .get("response")
        .and_then(|value| value.get("optionId"))
        .and_then(serde_json::Value::as_str)
        != Some("answer-0")
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
    let Command::Serve {
        host,
        port,
        relay_endpoint,
        app_base_url,
    } = parse_command(&args)?
    else {
        return Err("expected serve command".into());
    };
    if host != "127.0.0.1" {
        return Err(format!("unexpected host {host}").into());
    }
    if port != 4174 {
        return Err(format!("unexpected port {port}").into());
    }
    if relay_endpoint.is_some() {
        return Err("unexpected relay endpoint".into());
    }
    if app_base_url != "https://app.conduit.local" {
        return Err(format!("unexpected app base url {app_base_url}").into());
    }
    Ok(())
}

#[test]
fn serve_accepts_app_base_url() -> TestResult<()> {
    let args = strings(&["serve", "--app-base-url", "https://expo.test/app"]);
    let Command::Serve { app_base_url, .. } = parse_command(&args)? else {
        return Err("expected serve command".into());
    };
    if app_base_url == "https://expo.test/app" {
        return Ok(());
    }
    Err(format!("unexpected app base url {app_base_url}").into())
}

#[test]
fn pair_requires_relay_endpoint() -> TestResult<()> {
    let args = strings(&["pair", "--json"]);
    let error = parse_command(&args)
        .err()
        .ok_or("pair unexpectedly parsed")?;
    if matches!(error, ServiceError::MissingRelayEndpoint) {
        return Ok(());
    }
    Err(format!("unexpected error {error}").into())
}

#[test]
fn pair_accepts_relay_endpoint() -> TestResult<()> {
    let args = strings(&[
        "pair",
        "--json",
        "--relay-endpoint",
        "relay.example.test:443",
    ]);
    let Command::Pair {
        relay_endpoint,
        app_base_url,
    } = parse_command(&args)?
    else {
        return Err("expected pair command".into());
    };
    if relay_endpoint != "relay.example.test:443" {
        return Err(format!("unexpected relay endpoint {relay_endpoint}").into());
    }
    if app_base_url != "https://app.conduit.local" {
        return Err(format!("unexpected app base url {app_base_url}").into());
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
