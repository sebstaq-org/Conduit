//! Integration tests for the consumer runtime manager.

mod support;

use acp_core::ConnectionState;
use acp_discovery::ProviderId;
use app_api as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime::{RuntimeEvent, RuntimeEventKind};
use std::fs::read_to_string;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, ensure_event, runtime};
use thiserror as _;

#[test]
fn dispatch_reuses_provider_between_commands() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state));
    let first = runtime.dispatch(command("1", "initialize", "claude", json!({})));
    let second = runtime.dispatch(command(
        "2",
        "session/new",
        "claude",
        json!({ "cwd": "/repo" }),
    ));

    assert_ok(&first)?;
    assert_ok(&second)?;
    let connect_count = connect_count(&state, ProviderId::Claude)?;
    if connect_count != Some(1) {
        return Err(format!("expected one claude connect, got {connect_count:?}").into());
    }
    Ok(())
}

#[test]
fn dispatch_rejects_unknown_provider() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command("1", "initialize", "bad", json!({})));

    if response.ok {
        return Err("unknown provider unexpectedly succeeded".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code != Some("unknown_provider".to_owned()) {
        return Err(format!("expected unknown_provider error, got {error_code:?}").into());
    }
    Ok(())
}

#[test]
fn disconnect_reconnects_next_provider_access() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state));
    assert_ok(&runtime.dispatch(command("1", "initialize", "codex", json!({}))))?;

    let disconnected = runtime.dispatch(command("2", "provider/disconnect", "codex", json!({})));
    let snapshot = runtime.dispatch(command("3", "snapshot/get", "codex", json!({})));

    assert_ok(&disconnected)?;
    assert_ok(&snapshot)?;
    let connection_state = snapshot.snapshot.map(|value| value.connection_state);
    if connection_state != Some(ConnectionState::Ready) {
        return Err(format!("expected reconnected snapshot, got {connection_state:?}").into());
    }
    let connect_count = connect_count(&state, ProviderId::Codex)?;
    if connect_count != Some(2) {
        return Err(format!("expected reconnect after disconnect, got {connect_count:?}").into());
    }
    Ok(())
}

#[test]
fn provider_snapshot_alias_is_not_supported() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command("1", "provider/snapshot", "codex", json!({})));

    if response.ok {
        return Err("provider/snapshot unexpectedly succeeded".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code != Some("unsupported_command".to_owned()) {
        return Err(format!("expected unsupported_command, got {error_code:?}").into());
    }
    Ok(())
}

#[test]
fn event_subscription_returns_cursor_and_raw_wire_truth() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command("1", "events/subscribe", "copilot", json!({})));

    assert_ok(&response)?;
    ensure_array(&response.result, "events")?;
    ensure_array(&response.result, "raw_wire_events")?;
    if !response
        .result
        .get("next_sequence")
        .is_some_and(serde_json::Value::is_u64)
    {
        return Err(format!("expected next sequence, got {}", response.result).into());
    }
    Ok(())
}

#[test]
fn event_subscription_filters_by_cursor() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state);
    assert_ok(&runtime.dispatch(command("1", "initialize", "copilot", json!({}))))?;
    let cursor = runtime.latest_event_sequence();
    assert_ok(&runtime.dispatch(command(
        "2",
        "session/new",
        "copilot",
        json!({ "cwd": "/repo" }),
    )))?;
    let response = runtime.dispatch(command(
        "3",
        "events/subscribe",
        "copilot",
        json!({ "after_sequence": cursor }),
    ));

    assert_ok(&response)?;
    let events = response
        .result
        .get("events")
        .and_then(serde_json::Value::as_array)
        .ok_or("events result was not an array")?;
    if events
        .iter()
        .any(|event| event.get("sequence").and_then(serde_json::Value::as_u64) <= Some(cursor))
    {
        return Err("events/subscribe replayed history before cursor".into());
    }
    Ok(())
}

#[test]
fn prompt_dispatch_records_lifecycle_events() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command(
        "1",
        "session/prompt",
        "codex",
        json!({ "session_id": "session-1", "prompt": "hello" }),
    ));

    assert_ok(&response)?;
    let events = runtime.drain_events();
    ensure_event(&events, RuntimeEventKind::PromptStarted)?;
    ensure_event(&events, RuntimeEventKind::PromptUpdateObserved)?;
    ensure_event(&events, RuntimeEventKind::PromptCompleted)?;
    Ok(())
}

#[test]
fn cancel_dispatch_records_cancel_without_final_state() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state);
    let response = runtime.dispatch(command(
        "1",
        "session/cancel",
        "claude",
        json!({ "session_id": "session-1" }),
    ));

    assert_ok(&response)?;
    let events = runtime.drain_events();
    ensure_event(&events, RuntimeEventKind::CancelSent)?;
    if events
        .iter()
        .any(|event| event.kind == RuntimeEventKind::PromptCompleted)
    {
        return Err("cancel invented a provider-independent prompt completion".into());
    }
    Ok(())
}

#[test]
fn golden_consumer_event_stream_deserializes() -> TestResult<()> {
    let contents = read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(2)
            .ok_or("could not resolve backend service root")?
            .join("testdata/golden/consumer-events.json"),
    )?;
    let events: Vec<RuntimeEvent> = serde_json::from_str(&contents)?;
    if events.len() < 4 {
        return Err("golden consumer event stream is too small".into());
    }
    ensure_event(&events, RuntimeEventKind::PromptStarted)?;
    ensure_event(&events, RuntimeEventKind::PromptCompleted)?;
    Ok(())
}

fn connect_count(state: &Arc<Mutex<FakeState>>, provider: ProviderId) -> TestResult<Option<usize>> {
    Ok(state
        .lock()
        .map_err(|error| format!("state poisoned: {error}"))?
        .connects
        .get(&provider)
        .copied())
}

fn ensure_array(value: &Value, field: &str) -> TestResult<()> {
    if value.get(field).is_some_and(serde_json::Value::is_array) {
        return Ok(());
    }
    Err(format!("expected array field {field}, got {value}").into())
}
