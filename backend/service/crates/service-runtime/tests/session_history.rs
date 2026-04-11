//! Integration tests for the loaded session history read model.

mod support;

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use app_api as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime::{ConsumerResponse, RuntimeEventKind, ServiceRuntime};
use std::sync::{Arc, Mutex};
use support::{FakeFactory, FakeState, TestResult, assert_ok, command, ensure_event, runtime};
use thiserror as _;

#[test]
fn session_open_returns_latest_history_window_and_older_cursor() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        history_fixture_updates(),
    )?;
    let mut runtime = runtime(state);

    let opened = open_session(&mut runtime, "1", "codex", "session-1", 3);

    assert_ok(&opened)?;
    ensure_event(
        &runtime.drain_events(),
        RuntimeEventKind::SessionReplayUpdate,
    )?;
    assert_items(
        &opened.result,
        &[
            ("event", "tool_call", None),
            ("message", "user_message_chunk", Some("new user")),
            ("message", "agent_message_chunk", Some("new agent")),
        ],
    )?;
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();
    let next_cursor = string_field(&opened.result, "nextCursor")?.to_owned();
    assert_older_history_page(&mut runtime, &open_session_id, &next_cursor, "2")?;
    assert_older_history_page(&mut runtime, &open_session_id, &next_cursor, "3")
}

fn assert_older_history_page(
    runtime: &mut ServiceRuntime<FakeFactory>,
    open_session_id: &str,
    next_cursor: &str,
    command_id: &str,
) -> TestResult<()> {
    let older = runtime.dispatch(command(
        command_id,
        "session/history",
        "codex",
        json!({
            "openSessionId": open_session_id,
            "cursor": next_cursor,
            "limit": 3
        }),
    ));

    assert_ok(&older)?;
    assert_items(
        &older.result,
        &[
            ("message", "user_message_chunk", Some("old user")),
            ("message", "agent_message_chunk", Some("old agent")),
        ],
    )?;
    if older.result.get("nextCursor").is_some_and(Value::is_null) {
        return Ok(());
    }
    Err(format!(
        "expected null nextCursor at history start: {}",
        older.result
    )
    .into())
}

#[test]
fn session_history_rejects_provider_mismatch() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Claude,
        "session-1",
        vec![transcript_update(0, "agent_message_chunk", "loaded")],
    )?;
    let mut runtime = runtime(state);
    let opened = open_session(&mut runtime, "1", "claude", "session-1", 40);
    assert_ok(&opened)?;

    let response = runtime.dispatch(command(
        "2",
        "session/history",
        "codex",
        json!({
            "openSessionId": string_field(&opened.result, "openSessionId")?
        }),
    ));

    if response.ok {
        return Err("session/history unexpectedly accepted provider mismatch".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code == Some("invalid_params".to_owned()) {
        return Ok(());
    }
    Err(format!("expected invalid_params, got {error_code:?}").into())
}

fn history_fixture_updates() -> Vec<TranscriptUpdateSnapshot> {
    vec![
        transcript_update(0, "user_message_chunk", "old user"),
        transcript_update(1, "agent_message_chunk", "old agent"),
        TranscriptUpdateSnapshot {
            index: 2,
            variant: "tool_call".to_owned(),
            update: json!({
                "sessionUpdate": "tool_call",
                "toolCallId": "tool-1",
                "title": "Read file"
            }),
        },
        transcript_update(3, "user_message_chunk", "new user"),
        transcript_update(4, "agent_message_chunk", "new agent"),
    ]
}

fn seed_session_load_updates(
    state: &Arc<Mutex<FakeState>>,
    provider: ProviderId,
    session_id: &str,
    updates: Vec<TranscriptUpdateSnapshot>,
) -> TestResult<()> {
    state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_load_updates
        .insert((provider, session_id.to_owned()), updates);
    Ok(())
}

fn open_session(
    runtime: &mut ServiceRuntime<FakeFactory>,
    id: &str,
    provider: &str,
    session_id: &str,
    limit: u64,
) -> ConsumerResponse {
    runtime.dispatch(command(
        id,
        "session/open",
        provider,
        json!({
            "sessionId": session_id,
            "cwd": "/repo",
            "limit": limit
        }),
    ))
}

fn transcript_update(index: usize, variant: &str, text: &str) -> TranscriptUpdateSnapshot {
    TranscriptUpdateSnapshot {
        index,
        variant: variant.to_owned(),
        update: json!({
            "sessionUpdate": variant,
            "content": {
                "type": "text",
                "text": text
            }
        }),
    }
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
            let variant = item
                .get("sourceVariants")
                .and_then(Value::as_array)
                .and_then(|variants| variants.first())
                .and_then(Value::as_str)
                .or_else(|| item.get("variant").and_then(Value::as_str))
                .ok_or_else(|| format!("missing item variant: {item}"))?;
            let text = item.get("text").and_then(Value::as_str);
            Ok((kind, variant, text))
        })
        .collect::<TestResult<Vec<_>>>()?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected items {expected:?}, got {actual:?}").into())
}
