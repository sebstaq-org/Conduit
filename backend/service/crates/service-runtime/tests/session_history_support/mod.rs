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
    provider: &str,
    open_session_id: &str,
    limit: u64,
) -> ConsumerResponse {
    runtime.dispatch(command(
        id,
        "session/history",
        provider,
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
        "codex",
        json!({
            "openSessionId": open_session_id,
            "prompt": prompt
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

pub(crate) fn assert_prompt_turn_status(value: &Value, status: &str) -> TestResult<()> {
    let items = value
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing items: {value}"))?;
    let prompt_items = items
        .iter()
        .filter(|item| item.get("turnId").and_then(Value::as_str).is_some())
        .collect::<Vec<_>>();
    if prompt_items.len() != 2 {
        return Err(format!("expected two prompt turn items, got {prompt_items:?}").into());
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
