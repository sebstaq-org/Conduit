//! Integration tests for explicit provider initialize lifecycle.

mod support;

use acp_discovery::ProviderId;
use app_api as _;
#[cfg(feature = "benchmarks")]
use criterion as _;
use schemars as _;
use serde as _;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn provider_session_commands_initialize_before_acp_sessions() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state))?;

    assert_ok(&runtime.dispatch(command("1", "session/list", "codex", json!({}))))?;
    assert_ok(&runtime.dispatch(command(
        "2",
        "session/new",
        "claude",
        json!({ "cwd": "/repo" }),
    )))?;
    assert_ok(&runtime.dispatch(command(
        "3",
        "session/load",
        "copilot",
        json!({ "session_id": "loaded-session", "cwd": "/repo" }),
    )))?;

    let operations = state
        .lock()
        .map_err(|error| format!("state poisoned: {error}"))?
        .operations
        .clone();
    let expected = vec![
        (ProviderId::Codex, "initialize".to_owned()),
        (ProviderId::Codex, "session/list".to_owned()),
        (ProviderId::Claude, "initialize".to_owned()),
        (ProviderId::Claude, "session/new".to_owned()),
        (ProviderId::Copilot, "initialize".to_owned()),
        (ProviderId::Copilot, "session/load".to_owned()),
    ];
    if operations == expected {
        return Ok(());
    }
    Err(format!("unexpected provider operation order: {operations:?}").into())
}

#[test]
fn initialize_returns_initialize_contract_not_snapshot_contract() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command("1", "initialize", "codex", json!({})));

    assert_ok(&response)?;
    assert_json_string(&response.result, "/request/method", "initialize")?;
    assert_json_string(&response.result, "/request/clientInfo/name", "conduit")?;
    assert_json_string(&response.result, "/response/agentInfo/name", "fake-agent")?;
    if response
        .result
        .pointer("/request/protocolVersion")
        .is_none()
    {
        return Err("initialize request missing protocolVersion".into());
    }
    if !response
        .result
        .pointer("/request/clientCapabilities")
        .is_some_and(Value::is_object)
    {
        return Err("initialize request missing clientCapabilities".into());
    }
    if !response
        .result
        .pointer("/response/agentCapabilities")
        .is_some_and(Value::is_object)
    {
        return Err("initialize response missing agentCapabilities".into());
    }
    if !response
        .result
        .pointer("/response/authMethods")
        .is_some_and(Value::is_array)
    {
        return Err("initialize response missing authMethods".into());
    }
    if response.result.get("connection_state").is_none()
        && response.result.get("provider").is_none()
    {
        return Ok(());
    }
    Err(format!(
        "initialize result leaked snapshot shape: {}",
        response.result
    )
    .into())
}

fn assert_json_string(value: &Value, pointer: &str, expected: &str) -> TestResult<()> {
    if value.pointer(pointer).and_then(Value::as_str) == Some(expected) {
        return Ok(());
    }
    Err(format!("expected {pointer} to equal {expected}, got {value}").into())
}
