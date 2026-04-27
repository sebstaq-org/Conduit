//! Test helpers for the loaded session history read model.

use crate::support::{FakeFactory, FakeState, TestResult, command};
use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::{ConsumerResponse, RuntimeEvent, RuntimeEventKind, ServiceRuntime};
use std::sync::{Arc, Mutex};

pub(crate) fn assert_invalid_params(response: &ConsumerResponse) -> TestResult<()> {
    if response.ok {
        return Err(format!("expected invalid_params, got ok response {response:?}").into());
    }
    let error_code = response.error.as_ref().map(|error| error.code.as_str());
    if error_code == Some("invalid_params") {
        return Ok(());
    }
    Err(format!("expected invalid_params, got {error_code:?}").into())
}

pub(crate) fn assert_provider_error(response: &ConsumerResponse) -> TestResult<()> {
    if response.ok {
        return Err(format!("expected provider_error, got ok response {response:?}").into());
    }
    let error_code = response.error.as_ref().map(|error| error.code.as_str());
    if error_code == Some("provider_error") {
        return Ok(());
    }
    Err(format!("expected provider_error, got {error_code:?}").into())
}

pub(crate) fn history_fixture_updates() -> Vec<TranscriptUpdateSnapshot> {
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

pub(crate) fn seed_session_load_updates(
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

pub(crate) fn open_session(
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

pub(crate) fn open_session_with_cwd(
    runtime: &mut ServiceRuntime<FakeFactory>,
    id: &str,
    cwd: &str,
    limit: u64,
) -> ConsumerResponse {
    runtime.dispatch(command(
        id,
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": cwd,
            "limit": limit
        }),
    ))
}

pub(crate) fn session_load_requests(
    state: &Arc<Mutex<FakeState>>,
) -> TestResult<Vec<(ProviderId, String)>> {
    Ok(state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_load_requests
        .clone())
}

pub(crate) fn transcript_update(
    index: usize,
    variant: &str,
    text: &str,
) -> TranscriptUpdateSnapshot {
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

pub(crate) fn string_field<'a>(value: &'a Value, field: &str) -> TestResult<&'a str> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing string field {field}: {value}").into())
}

pub(crate) fn number_field(value: &Value, field: &str) -> TestResult<i64> {
    value
        .get(field)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("missing numeric field {field}: {value}").into())
}

pub(crate) fn assert_timeline_event_advanced(
    events: &[RuntimeEvent],
    open_session_id: &str,
    revision_before_prompt: i64,
) -> TestResult<()> {
    let timeline_event = events
        .iter()
        .find(|event| event.kind == RuntimeEventKind::SessionTimelineChanged)
        .ok_or("missing session_timeline_changed event")?;
    if timeline_event
        .payload
        .get("openSessionId")
        .and_then(Value::as_str)
        != Some(open_session_id)
    {
        return Err(format!("timeline event used wrong payload: {timeline_event:?}").into());
    }
    let revision_after_prompt = timeline_event
        .payload
        .get("revision")
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("timeline event missing revision: {timeline_event:?}"))?;
    if revision_after_prompt > revision_before_prompt {
        return Ok(());
    }
    Err(format!(
        "timeline revision did not advance: {revision_before_prompt} -> {revision_after_prompt}"
    )
    .into())
}

pub(crate) fn read_history(
    runtime: &mut ServiceRuntime<FakeFactory>,
    id: &str,
    _provider: &str,
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

pub(crate) fn prompt_open_session(
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

pub(crate) fn assert_items(
    value: &Value,
    expected: &[(&str, &str, Option<&str>)],
) -> TestResult<()> {
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

pub(crate) fn assert_prompt_content(value: &Value, expected: &Value) -> TestResult<()> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let prompt_item = items
        .iter()
        .find(|item| {
            item.get("kind").and_then(Value::as_str) == Some("message")
                && item.get("role").and_then(Value::as_str) == Some("user")
                && item.get("turnId").and_then(Value::as_str).is_some()
        })
        .ok_or_else(|| format!("missing session_prompt item: {items:?}"))?;
    if prompt_item.get("content") == Some(expected) {
        return Ok(());
    }
    Err(
        format!("prompt content was not preserved: expected {expected}, got {prompt_item:?}")
            .into(),
    )
}

pub(crate) fn event_data_field(
    value: &Value,
    variant: &str,
    field: &str,
) -> TestResult<Option<i64>> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let event = items
        .iter()
        .find(|item| item.get("variant").and_then(Value::as_str) == Some(variant))
        .ok_or_else(|| format!("missing event variant {variant}: {items:?}"))?;
    Ok(event
        .get("data")
        .and_then(|data| data.get(field))
        .and_then(Value::as_i64))
}

pub(crate) fn assert_event_data_string(
    value: &Value,
    variant: &str,
    field: &str,
    expected: &str,
) -> TestResult<()> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let event = items
        .iter()
        .find(|item| item.get("variant").and_then(Value::as_str) == Some(variant))
        .ok_or_else(|| format!("missing event variant {variant}: {items:?}"))?;
    if event
        .get("data")
        .and_then(|data| data.get(field))
        .and_then(Value::as_str)
        == Some(expected)
    {
        return Ok(());
    }
    Err(format!("event {variant} field {field} mismatch: {event}").into())
}

pub(crate) fn assert_prompt_turn_status(value: &Value, status: &str) -> TestResult<()> {
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

pub(crate) fn assert_turn_stop_reason(value: &Value, stop_reason: &str) -> TestResult<()> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let prompt_item = items
        .iter()
        .rfind(|item| item.get("turnId").and_then(Value::as_str).is_some())
        .ok_or_else(|| format!("expected prompt turn items: {items:?}"))?;
    if prompt_item.get("stopReason").and_then(Value::as_str) == Some(stop_reason) {
        return Ok(());
    }
    Err(format!("prompt turn did not preserve stopReason {stop_reason}: {prompt_item:?}").into())
}
