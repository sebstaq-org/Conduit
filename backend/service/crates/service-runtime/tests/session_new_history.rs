//! Integration tests for new session history materialization.

mod support;

use app_api as _;
#[cfg(feature = "benchmarks")]
use criterion as _;
use jsonschema as _;
use schemars as _;
use serde as _;
use serde_json::{Value, json};
use serde_with as _;
use service_runtime::{ConsumerResponse, ServiceRuntime};
use std::sync::{Arc, Mutex};
use support::{FakeFactory, FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn session_new_materializes_open_session_for_prompt_history() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state))?;

    let created = runtime.dispatch(command(
        "1",
        "session/new",
        "codex",
        json!({ "cwd": "/repo", "limit": 10 }),
    ));
    assert_ok(&created)?;
    let session_id = string_field(&created.result, "sessionId")?;
    if session_id != "session-1" {
        return Err(format!("expected session-1, got {session_id}").into());
    }

    let history = created
        .result
        .get("history")
        .ok_or("session/new result missing history")?;
    let open_session_id = string_field(history, "openSessionId")?.to_owned();
    let initial_items = history
        .get("items")
        .and_then(Value::as_array)
        .ok_or("session/new history missing items")?;
    if !initial_items.is_empty() {
        return Err("session/new history should start without local transcript items".into());
    }

    let prompt = runtime.dispatch(command(
        "2",
        "session/prompt",
        "all",
        json!({
            "openSessionId": open_session_id,
            "prompt": [{ "type": "text", "text": "hello new session" }]
        }),
    ));
    assert_ok(&prompt)?;

    let latest = read_history(&mut runtime, "3", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "user", Some("hello new session")),
            ("message", "agent", Some("hello new session")),
        ],
    )?;
    assert_prompt_turn_status(&latest.result, "complete")
}

fn read_history(
    runtime: &mut ServiceRuntime<FakeFactory>,
    id: &str,
    open_session_id: &str,
    limit: u64,
) -> ConsumerResponse {
    runtime.dispatch(command(
        id,
        "session/history",
        "all",
        json!({
            "openSessionId": open_session_id,
            "limit": limit
        }),
    ))
}

fn string_field<'a>(value: &'a Value, field: &str) -> TestResult<&'a str> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing string field {field}: {value}").into())
}

fn assert_items(value: &Value, expected: &[(&str, &str, Option<&str>)]) -> TestResult<()> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let actual = items
        .iter()
        .map(|item| {
            let kind = item
                .get("kind")
                .and_then(Value::as_str)
                .ok_or_else(|| format!("missing item kind: {item}"))?;
            let identity = history_item_identity(item)?;
            let text = item_content_text(item);
            Ok((kind, identity, text))
        })
        .collect::<TestResult<Vec<_>>>()?;
    let expected = expected
        .iter()
        .map(|(kind, identity, text)| {
            (*kind, *identity, text.map(std::string::ToString::to_string))
        })
        .collect::<Vec<_>>();
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected items {expected:?}, got {actual:?}").into())
}

fn history_item_identity(item: &Value) -> TestResult<&str> {
    match item.get("kind").and_then(Value::as_str) {
        Some("message") => item
            .get("role")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("message item was missing role: {item}").into()),
        Some("event") => item
            .get("variant")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("event item was missing variant: {item}").into()),
        _ => Err(format!("history item had unsupported kind: {item}").into()),
    }
}

fn item_content_text(item: &Value) -> Option<String> {
    let content = item.get("content").and_then(Value::as_array)?;
    let text = content
        .iter()
        .filter_map(|content| content.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("");
    Some(text)
}

fn assert_prompt_turn_status(value: &Value, status: &str) -> TestResult<()> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let prompt_items = items
        .iter()
        .filter(|item| item.get("turnId").and_then(Value::as_str).is_some())
        .collect::<Vec<_>>();
    if prompt_items.len() < 2 {
        return Err(format!("expected prompt turn items, got {prompt_items:?}").into());
    }
    let turn_id = prompt_items[0]
        .get("turnId")
        .and_then(Value::as_str)
        .ok_or("first prompt item missing turnId")?;
    if prompt_items
        .iter()
        .all(|item| item.get("turnId").and_then(Value::as_str) == Some(turn_id))
        && prompt_items
            .last()
            .and_then(|item| item.get("status"))
            .and_then(Value::as_str)
            == Some(status)
    {
        return Ok(());
    }
    Err(format!("prompt turn metadata mismatch: {prompt_items:?}").into())
}
