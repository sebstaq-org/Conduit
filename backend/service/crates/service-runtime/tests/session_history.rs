//! Integration tests for the loaded session history read model.

mod session_history_support;
mod support;

use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use app_api as _;
use serde as _;
use serde_json::{Value, json};
use service_runtime::{RuntimeEventKind, ServiceRuntime};
use session_history_support::{
    assert_invalid_params, assert_items, assert_prompt_turn_status, assert_provider_error,
    assert_timeline_event_advanced, history_fixture_updates, number_field, open_session,
    open_session_with_cwd, prompt_open_session, read_history, seed_session_load_updates,
    session_load_requests, string_field, transcript_update,
};
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
    let mut runtime = runtime(state)?;

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
    let mut runtime = runtime(state)?;
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

#[test]
fn session_history_without_cursor_returns_latest_window_without_provider_load() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        history_fixture_updates(),
    )?;
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 2);
    assert_ok(&opened)?;
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();
    let loads_after_open = session_load_requests(&state)?.len();

    let latest = runtime.dispatch(command(
        "2",
        "session/history",
        "codex",
        json!({
            "openSessionId": open_session_id,
            "limit": 2
        }),
    ));

    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "user_message_chunk", Some("new user")),
            ("message", "agent_message_chunk", Some("new agent")),
        ],
    )?;
    let loads_after_history = session_load_requests(&state)?.len();
    if loads_after_history == loads_after_open {
        return Ok(());
    }
    Err(format!(
        "session/history without cursor caused provider load: {loads_after_open} -> {loads_after_history}"
    )
    .into())
}

#[test]
fn session_prompt_open_session_appends_to_timeline_and_emits_revision() -> TestResult<()> {
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
        .prompt_agent_text
        .insert(
            (ProviderId::Codex, "session-1".to_owned()),
            vec!["agent ".to_owned(), "reply".to_owned()],
        );
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();
    let revision_before_prompt = number_field(&opened.result, "revision")?;

    let prompt = runtime.dispatch(command(
        "2",
        "session/prompt",
        "codex",
        json!({
            "openSessionId": open_session_id,
            "prompt": "user prompt"
        }),
    ));

    assert_ok(&prompt)?;
    let events = runtime.drain_events();
    assert_timeline_event_advanced(&events, &open_session_id, revision_before_prompt)?;
    let latest = read_history(&mut runtime, "3", "codex", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "agent_message_chunk", Some("loaded")),
            ("message", "session_prompt", Some("user prompt")),
            ("message", "agent_message_chunk", Some("agent reply")),
        ],
    )?;
    assert_prompt_turn_status(&latest.result, "complete")?;
    let requests = session_load_requests(&state)?;
    if requests == vec![(ProviderId::Codex, "session-1".to_owned())] {
        return Ok(());
    }
    Err(format!("prompt/history caused unexpected session/load calls: {requests:?}").into())
}

#[test]
fn session_prompt_projects_ordered_session_updates_and_extension_events() -> TestResult<()> {
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
            vec![
                transcript_update(0, "agent_message_chunk", "left "),
                TranscriptUpdateSnapshot {
                    index: 1,
                    variant: "usage_update".to_owned(),
                    update: json!({
                        "sessionUpdate": "usage_update",
                        "used": 12,
                        "size": 100
                    }),
                },
                transcript_update(2, "agent_message_chunk", "right"),
            ],
        );
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();

    let prompt = prompt_open_session(&mut runtime, "2", &open_session_id, "user prompt");

    assert_ok(&prompt)?;
    let events = runtime.drain_events();
    ensure_event(&events, RuntimeEventKind::PromptUpdateObserved)?;
    let latest = read_history(&mut runtime, "3", "codex", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "agent_message_chunk", Some("loaded")),
            ("message", "session_prompt", Some("user prompt")),
            ("message", "agent_message_chunk", Some("left ")),
            ("event", "usage_update", None),
            ("message", "agent_message_chunk", Some("right")),
        ],
    )?;
    assert_prompt_turn_status(&latest.result, "complete")
}

#[test]
fn session_prompt_rejects_open_session_from_other_provider() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        vec![transcript_update(0, "agent_message_chunk", "loaded")],
    )?;
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();

    let prompt = runtime.dispatch(command(
        "2",
        "session/prompt",
        "claude",
        json!({
            "openSessionId": open_session_id,
            "prompt": "wrong provider"
        }),
    ));

    assert_invalid_params(&prompt)?;
    let events = runtime.drain_events();
    if events.is_empty() {
        return Ok(());
    }
    Err(format!("provider mismatch produced events: {events:?}").into())
}

#[test]
fn session_prompt_open_session_marks_cancelled_turn_status() -> TestResult<()> {
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
        .prompt_stop_reason
        .insert(
            (ProviderId::Codex, "session-1".to_owned()),
            "cancelled".to_owned(),
        );
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();

    let prompt = runtime.dispatch(command(
        "2",
        "session/prompt",
        "codex",
        json!({
            "openSessionId": open_session_id,
            "prompt": "cancel me"
        }),
    ));
    assert_ok(&prompt)?;
    runtime.drain_events();
    let latest = runtime.dispatch(command(
        "3",
        "session/history",
        "codex",
        json!({
            "openSessionId": open_session_id,
            "limit": 10
        }),
    ));

    assert_ok(&latest)?;
    assert_prompt_turn_status(&latest.result, "cancelled")
}

#[test]
fn session_prompt_open_session_provider_error_appends_failed_turn() -> TestResult<()> {
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
            "provider failed".to_owned(),
        );
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();
    let revision_before_prompt = number_field(&opened.result, "revision")?;

    let prompt = prompt_open_session(&mut runtime, "2", &open_session_id, "boom");

    assert_provider_error(&prompt)?;
    let events = runtime.drain_events();
    assert_timeline_event_advanced(&events, &open_session_id, revision_before_prompt)?;
    let latest = read_history(&mut runtime, "3", "codex", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "agent_message_chunk", Some("loaded")),
            ("message", "session_prompt", Some("boom")),
            ("message", "session_prompt_failed", Some("")),
        ],
    )?;
    assert_prompt_turn_status(&latest.result, "failed")
}

#[test]
fn session_prompt_open_session_missing_lifecycle_appends_failed_turn() -> TestResult<()> {
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
        .prompt_lifecycle_missing
        .insert((ProviderId::Codex, "session-1".to_owned()));
    let mut runtime = runtime(Arc::clone(&state))?;
    let opened = open_session(&mut runtime, "1", "codex", "session-1", 10);
    assert_ok(&opened)?;
    runtime.drain_events();
    let open_session_id = string_field(&opened.result, "openSessionId")?.to_owned();
    let revision_before_prompt = number_field(&opened.result, "revision")?;

    let prompt = prompt_open_session(&mut runtime, "2", &open_session_id, "missing lifecycle");

    assert_ok(&prompt)?;
    let events = runtime.drain_events();
    assert_timeline_event_advanced(&events, &open_session_id, revision_before_prompt)?;
    let latest = read_history(&mut runtime, "3", "codex", &open_session_id, 10);
    assert_ok(&latest)?;
    assert_items(
        &latest.result,
        &[
            ("message", "agent_message_chunk", Some("loaded")),
            ("message", "session_prompt", Some("missing lifecycle")),
            ("message", "session_prompt_failed", Some("")),
        ],
    )?;
    assert_prompt_turn_status(&latest.result, "failed")
}

#[test]
fn repeated_session_open_refreshes_provider_load_and_keeps_envelope_shape() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        vec![transcript_update(0, "agent_message_chunk", "loaded")],
    )?;
    let mut runtime = runtime(Arc::clone(&state))?;

    let first = open_session(&mut runtime, "1", "codex", "session-1", 40);
    let second = open_session(&mut runtime, "2", "codex", "session-1", 40);

    assert_ok(&first)?;
    assert_ok(&second)?;
    if first.snapshot.is_some() || second.snapshot.is_some() {
        return Err("session/open should return a read-model response without snapshot".into());
    }
    if string_field(&first.result, "openSessionId")?
        != string_field(&second.result, "openSessionId")?
    {
        return Err("repeated session/open changed openSessionId".into());
    }
    let requests = state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_load_requests
        .clone();
    let expected = vec![
        (ProviderId::Codex, "session-1".to_owned()),
        (ProviderId::Codex, "session-1".to_owned()),
    ];
    if requests == expected {
        return Ok(());
    }
    Err(format!("expected repeated provider loads {expected:?}, got {requests:?}").into())
}

#[test]
fn session_open_invalid_limit_has_no_provider_or_event_side_effects() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        vec![transcript_update(0, "agent_message_chunk", "loaded")],
    )?;
    let mut runtime = runtime(Arc::clone(&state))?;

    let response = runtime.dispatch(command(
        "1",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "/repo",
            "limit": 0
        }),
    ));

    assert_invalid_params(&response)?;
    let requests = session_load_requests(&state)?;
    if requests.is_empty() && runtime.drain_events().is_empty() {
        return Ok(());
    }
    Err(format!("invalid limit caused side effects: {requests:?}").into())
}

#[test]
fn session_open_requires_absolute_normalized_cwd_identity() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_session_load_updates(
        &state,
        ProviderId::Codex,
        "session-1",
        vec![transcript_update(0, "agent_message_chunk", "loaded")],
    )?;
    let mut runtime = runtime(Arc::clone(&state))?;

    let relative = runtime.dispatch(command(
        "1",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "repo",
            "limit": 40
        }),
    ));
    assert_invalid_params(&relative)?;
    if !session_load_requests(&state)?.is_empty() {
        return Err("relative cwd reached provider session/load".into());
    }

    let dotted = open_session_with_cwd(&mut runtime, "2", "/repo/.", 40);
    let normalized = open_session_with_cwd(&mut runtime, "3", "/repo", 40);

    assert_ok(&dotted)?;
    assert_ok(&normalized)?;
    if string_field(&dotted.result, "openSessionId")?
        != string_field(&normalized.result, "openSessionId")?
    {
        return Err("normalized cwd variants produced different openSessionIds".into());
    }
    Ok(())
}
