//! Integration tests for Codex terminal-plan transcript projection.

mod support;

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use app_api as _;
#[cfg(feature = "benchmarks")]
use criterion as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime::{ConsumerResponse, RuntimeEvent, RuntimeEventKind, ServiceRuntime};
use std::sync::{Arc, Mutex};
use support::{FakeFactory, FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn session_prompt_preserves_codex_terminal_plan_as_timeline_event() -> TestResult<()> {
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
        .prompt_updates
        .insert(
            (ProviderId::Codex, "session-1".to_owned()),
            vec![terminal_plan_update(0)],
        );
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();
    let revision_before_prompt = number_field(&opened.result, "revision")?;

    let prompt = prompt_open_session(&mut runtime, "2", &open_session_id, "plan prompt");

    assert_ok(&prompt)?;
    let events = runtime.drain_events();
    assert_timeline_event_advanced(&events, &open_session_id, revision_before_prompt)?;
    assert_timeline_contains_terminal_plan(&events)?;
    let latest = read_history(&mut runtime, "3", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "agent", Some("loaded")),
            ("message", "user", Some("plan prompt")),
            ("message", "agent", Some("# Plan\n")),
            ("event", "terminal_plan", None),
        ],
    )?;
    assert_event_string_field(
        &latest.result,
        "terminal_plan",
        "interactionId",
        "terminal-plan:item-plan",
    )?;
    assert_event_string_field(
        &latest.result,
        "terminal_plan",
        "providerSource",
        "TurnItem::Plan",
    )?;
    assert_event_string_field(&latest.result, "terminal_plan", "planText", "# Plan\n")?;
    assert_prompt_turn_status(&latest.result, "complete")
}

fn terminal_plan_update(index: usize) -> TranscriptUpdateSnapshot {
    TranscriptUpdateSnapshot {
        index,
        variant: "agent_message_chunk".to_owned(),
        update: json!({
            "sessionUpdate": "agent_message_chunk",
            "content": {
                "type": "text",
                "text": "# Plan\n"
            },
            "_meta": {
                "codex": {
                    "terminalPlan": {
                        "source": "TurnItem::Plan",
                        "text": "# Plan\n",
                        "itemId": "item-plan",
                        "turnId": "codex-turn",
                        "threadId": "codex-thread"
                    }
                }
            }
        }),
    }
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

fn string_field<'a>(value: &'a Value, field: &str) -> TestResult<&'a str> {
    value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing string field {field}: {value}").into())
}

fn number_field(value: &Value, field: &str) -> TestResult<i64> {
    value
        .get(field)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("missing numeric field {field}: {value}").into())
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

fn assert_timeline_contains_terminal_plan(
    events: &[service_runtime::RuntimeEvent],
) -> TestResult<()> {
    if events.iter().any(|event| {
        event.kind == RuntimeEventKind::SessionTimelineChanged
            && event
                .payload
                .get("items")
                .and_then(Value::as_array)
                .is_some_and(|items| {
                    items.iter().any(|item| {
                        item.get("variant").and_then(Value::as_str) == Some("terminal_plan")
                    })
                })
    }) {
        return Ok(());
    }
    Err(format!("timeline events did not include terminal_plan: {events:?}").into())
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
            Ok((kind, item_identity(item)?, item_content_text(item)))
        })
        .collect::<TestResult<Vec<_>>>()?;
    let expected = expected
        .iter()
        .map(|(kind, identity, text)| (*kind, *identity, text.map(ToOwned::to_owned)))
        .collect::<Vec<_>>();
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected items {expected:?}, got {actual:?}").into())
}

fn item_identity(item: &Value) -> TestResult<&str> {
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
    Some(
        content
            .iter()
            .filter_map(|content| content.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join(""),
    )
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
    let same_turn = prompt_items
        .iter()
        .all(|item| item.get("turnId").and_then(Value::as_str) == Some(turn_id));
    let last_status = prompt_items
        .last()
        .and_then(|item| item.get("status"))
        .and_then(Value::as_str);
    if same_turn && last_status == Some(status) {
        return Ok(());
    }
    Err(format!("prompt turn metadata mismatch: {prompt_items:?}").into())
}

fn assert_event_string_field(
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
    let actual = event
        .get("data")
        .and_then(|data| data.get(field))
        .and_then(Value::as_str);
    if actual == Some(expected) {
        return Ok(());
    }
    Err(format!("expected {variant}.{field}={expected:?}, got {actual:?}").into())
}
