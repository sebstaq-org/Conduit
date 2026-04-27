//! Regression coverage for failed prompt turns in session history.

mod support;

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use app_api as _;
use schemars as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime::{ConsumerResponse, RuntimeEvent, RuntimeEventKind, ServiceRuntime};
use std::sync::{Arc, Mutex};
use support::{FakeFactory, FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

const INCIDENT_ERROR: &str = "official ACP SDK error from codex during session/prompt";

#[test]
fn failed_session_prompt_surfaces_turn_error_in_history() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        vec![transcript_update(0, "agent_message_chunk", "loaded")],
    )?;
    state
        .lock()
        .map_err(|error| format!("{error}"))?
        .prompt_errors
        .insert(
            (ProviderId::Codex, "session-1".to_owned()),
            INCIDENT_ERROR.to_owned(),
        );
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();

    let prompt = prompt_open_session(&mut runtime, "2", &open_session_id, "user prompt");

    assert_provider_error(&prompt)?;
    assert_timeline_event_advanced(&runtime.drain_events(), &open_session_id, 1)?;
    let latest = read_history(&mut runtime, "3", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_failed_prompt_history(&latest.result)
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

fn prompt_open_session(
    runtime: &mut ServiceRuntime<FakeFactory>,
    id: &str,
    open_session_id: &str,
    prompt: &str,
) -> ConsumerResponse {
    runtime.dispatch(command(
        id,
        "session/prompt",
        "all",
        json!({
            "openSessionId": open_session_id,
            "prompt": [{ "type": "text", "text": prompt }]
        }),
    ))
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

fn assert_failed_prompt_history(value: &Value) -> TestResult<()> {
    let items = history_items(value)?;
    if items.len() != 3 {
        return Err(format!("expected 3 history items, got {items:?}").into());
    }
    assert_message(&items[0], "agent", "loaded")?;
    assert_message(&items[1], "user", "user prompt")?;
    assert_turn_error(&items[2])?;
    assert_prompt_turn_status(items, "failed")
}

fn history_items(value: &Value) -> TestResult<&[Value]> {
    Ok(value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?)
}

fn assert_message(item: &Value, role: &str, text: &str) -> TestResult<()> {
    if item.get("kind").and_then(Value::as_str) != Some("message")
        || item.get("role").and_then(Value::as_str) != Some(role)
        || item_content_text(item).as_deref() != Some(text)
    {
        return Err(format!("message mismatch for {role}/{text}: {item}").into());
    }
    Ok(())
}

fn assert_turn_error(item: &Value) -> TestResult<()> {
    if item.get("kind").and_then(Value::as_str) != Some("event")
        || item.get("source").and_then(Value::as_str) != Some("conduit")
        || item.get("variant").and_then(Value::as_str) != Some("turn_error")
        || item.get("status").and_then(Value::as_str) != Some("failed")
        || item.pointer("/data/message").and_then(Value::as_str) != Some(INCIDENT_ERROR)
        || item.pointer("/data/provider").and_then(Value::as_str) != Some("codex")
        || item.pointer("/data/sessionUpdate").is_some()
    {
        return Err(format!("turn_error event mismatch: {item}").into());
    }
    Ok(())
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

fn assert_prompt_turn_status(items: &[Value], status: &str) -> TestResult<()> {
    let prompt_items = items
        .iter()
        .filter(|item| item.get("turnId").and_then(Value::as_str).is_some())
        .collect::<Vec<_>>();
    let turn_id = prompt_items
        .first()
        .and_then(|item| item.get("turnId"))
        .and_then(Value::as_str)
        .ok_or_else(|| format!("expected prompt turn items, got {prompt_items:?}"))?;
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

fn string_field<'a>(value: &'a Value, field: &str) -> TestResult<&'a str> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing string field {field}: {value}").into())
}

fn assert_provider_error(response: &ConsumerResponse) -> TestResult<()> {
    if response.ok {
        return Err(format!("expected provider_error, got ok response {response:?}").into());
    }
    let error_code = response.error.as_ref().map(|error| error.code.as_str());
    if error_code == Some("provider_error") {
        return Ok(());
    }
    Err(format!("expected provider_error, got {error_code:?}").into())
}

fn assert_timeline_event_advanced(
    events: &[RuntimeEvent],
    open_session_id: &str,
    revision_before_prompt: i64,
) -> TestResult<()> {
    let timeline_event = events
        .iter()
        .find(|event| event.kind == RuntimeEventKind::SessionTimelineChanged)
        .ok_or("missing session_timeline_changed event")?;
    let revision_after_prompt = timeline_revision(timeline_event, open_session_id)?;
    if revision_after_prompt > revision_before_prompt {
        return Ok(());
    }
    Err(format!(
        "timeline revision did not advance: {revision_before_prompt} -> {revision_after_prompt}"
    )
    .into())
}

fn timeline_revision(event: &RuntimeEvent, open_session_id: &str) -> TestResult<i64> {
    if event.payload.get("openSessionId").and_then(Value::as_str) != Some(open_session_id) {
        return Err(format!("timeline event used wrong payload: {event:?}").into());
    }
    event
        .payload
        .get("revision")
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("timeline event missing revision: {event:?}").into())
}
