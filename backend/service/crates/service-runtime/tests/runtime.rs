//! Integration tests for the consumer runtime manager.

mod support;

use acp_discovery::ProviderId;
use app_api as _;
use serde as _;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn dispatch_reuses_provider_between_commands() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state))?;
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
    let mut runtime = runtime(state)?;
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
    let mut runtime = runtime(Arc::clone(&state))?;
    assert_ok(&runtime.dispatch(command("1", "initialize", "codex", json!({}))))?;

    let disconnected = runtime.dispatch(command("2", "provider/disconnect", "codex", json!({})));
    let reconnected = runtime.dispatch(command(
        "3",
        "session/new",
        "codex",
        json!({ "cwd": "/repo" }),
    ));

    assert_ok(&disconnected)?;
    assert_ok(&reconnected)?;
    let connect_count = connect_count(&state, ProviderId::Codex)?;
    if connect_count != Some(2) {
        return Err(format!("expected reconnect after disconnect, got {connect_count:?}").into());
    }
    Ok(())
}

#[test]
fn provider_snapshot_alias_is_not_supported() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
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
fn sessions_watch_returns_minimal_ack() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command("1", "sessions/watch", "all", json!({})));

    assert_ok(&response)?;
    if response.result == json!({ "subscribed": true }) {
        return Ok(());
    }
    Err(format!("unexpected sessions/watch result {}", response.result).into())
}

#[test]
fn projects_add_list_and_remove_drive_group_scope() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_grouped_session_lists(&state)?;
    let mut runtime = runtime(state)?;
    let empty = dispatch_after_group_refresh(
        &mut runtime,
        command("empty", "sessions/grouped", "all", json!({})),
    )?;
    assert_ok(&empty)?;
    assert_group_count(&empty.result, 0)?;

    add_project(&mut runtime, "/repo/.")?;
    let listed = runtime.dispatch(command("list", "projects/list", "all", json!({})));
    assert_ok(&listed)?;
    assert_project_cwds(&listed.result, &["/repo"])?;

    let with_project = dispatch_after_group_refresh(
        &mut runtime,
        command("grouped", "sessions/grouped", "all", json!({})),
    )?;
    assert_ok(&with_project)?;
    assert_group_identity(&with_project.result, "/repo", "cwd:/repo")?;

    assert_ok(&runtime.dispatch(command(
        "remove",
        "projects/remove",
        "all",
        json!({ "projectId": "cwd:/repo" }),
    )))?;
    let removed = runtime.dispatch(command("removed", "sessions/grouped", "all", json!({})));
    assert_ok(&removed)?;
    assert_group_count(&removed.result, 0)
}

#[test]
fn raw_event_subscription_is_not_a_product_command() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command(
        "1",
        "events/subscribe",
        "copilot",
        json!({ "after_sequence": 0 }),
    ));

    if response.ok {
        return Err("events/subscribe unexpectedly succeeded".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code == Some("unsupported_command".to_owned()) {
        return Ok(());
    }
    Err(format!("expected unsupported_command, got {error_code:?}").into())
}

#[test]
fn grouped_sessions_groups_by_cwd_and_filters_recent_rows() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_grouped_session_lists(&state)?;
    let mut runtime = runtime(state)?;
    add_project(&mut runtime, "/repo")?;
    let response = dispatch_after_group_refresh(
        &mut runtime,
        command(
            "1",
            "sessions/grouped",
            "all",
            json!({
                "updatedWithinDays": 5
            }),
        ),
    )?;

    assert_ok(&response)?;
    assert_group_identity(&response.result, "/repo", "cwd:/repo")?;
    let sessions = grouped_sessions(&response.result, "/repo")?;
    assert_session_ids(sessions, &["claude-recent", "codex-recent"])?;
    assert_session_updated_at(sessions, "claude-recent", "9999-01-02T00:00:00Z")
}

#[test]
fn grouped_sessions_rejects_cwd_filters_product_path() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command(
        "1",
        "sessions/grouped",
        "all",
        json!({
            "cwdFilters": ["/repo"]
        }),
    ));

    if response.ok {
        return Err("sessions/grouped unexpectedly accepted cwdFilters".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code != Some("invalid_params".to_owned()) {
        return Err(format!("expected invalid_params, got {error_code:?}").into());
    }
    Ok(())
}

#[test]
fn grouped_sessions_rejects_params_providers() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command(
        "1",
        "sessions/grouped",
        "all",
        json!({
            "providers": ["codex"]
        }),
    ));

    if response.ok {
        return Err("sessions/grouped unexpectedly accepted params.providers".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code != Some("invalid_params".to_owned()) {
        return Err(format!("expected invalid_params, got {error_code:?}").into());
    }
    Ok(())
}

#[test]
fn grouped_sessions_can_target_one_provider() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_grouped_session_lists(&state)?;
    let mut runtime = runtime(state)?;
    add_project(&mut runtime, "/repo")?;
    let response = dispatch_after_group_refresh(
        &mut runtime,
        command(
            "1",
            "sessions/grouped",
            "codex",
            json!({
                "updatedWithinDays": null
            }),
        ),
    )?;

    assert_ok(&response)?;
    assert_group_identity(&response.result, "/repo", "cwd:/repo")?;
    let sessions = grouped_sessions(&response.result, "/repo")?;
    assert_session_ids(sessions, &["codex-recent"])
}

#[test]
fn grouped_sessions_keeps_cached_rows_when_provider_refresh_fails() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_grouped_session_lists(&state)?;
    let mut runtime = runtime(Arc::clone(&state))?;
    add_project(&mut runtime, "/repo")?;
    let request = command(
        "1",
        "sessions/grouped",
        "all",
        json!({ "updatedWithinDays": null }),
    );
    let response = dispatch_after_group_refresh(&mut runtime, request.clone())?;
    assert_ok(&response)?;
    state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_list_errors
        .insert(ProviderId::Claude, "claude list failed".to_owned());
    let cached = runtime.dispatch(request.clone());
    assert_ok(&cached)?;
    assert_session_ids(
        grouped_sessions(&cached.result, "/repo")?,
        &["claude-recent", "codex-recent", "copilot-old"],
    )?;
    let refresh = runtime.force_refresh_session_index("all");
    if refresh.is_ok() {
        return Err("sessions/grouped refresh unexpectedly swallowed provider failure".into());
    }
    Ok(())
}

#[test]
fn grouped_sessions_uses_projects_and_exhausts_cursors() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_paginated_session_lists(&state)?;
    let mut runtime = runtime(Arc::clone(&state))?;
    add_project(&mut runtime, "/repo/.")?;
    add_project(&mut runtime, "/other//")?;
    let response = dispatch_after_group_refresh(
        &mut runtime,
        command(
            "1",
            "sessions/grouped",
            "codex",
            json!({
                "updatedWithinDays": null
            }),
        ),
    )?;

    assert_ok(&response)?;
    assert_group_identity(&response.result, "/repo", "cwd:/repo")?;
    assert_group_identity(&response.result, "/other", "cwd:/other")?;
    assert_session_ids(
        grouped_sessions(&response.result, "/repo")?,
        &["repo-page-2", "repo-page-1"],
    )?;
    assert_session_ids(
        grouped_sessions(&response.result, "/other")?,
        &["other-page-1"],
    )?;
    let requests = state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_list_requests
        .clone();
    let expected = vec![
        (ProviderId::Codex, Some("/other".to_owned()), None),
        (ProviderId::Codex, Some("/repo".to_owned()), None),
        (
            ProviderId::Codex,
            Some("/repo".to_owned()),
            Some("repo-page-2".to_owned()),
        ),
    ];
    if requests != expected {
        return Err(format!("expected list requests {expected:?}, got {requests:?}").into());
    }
    Ok(())
}

#[test]
fn grouped_sessions_null_updated_window_includes_all_time() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_lists
        .insert(
            ProviderId::Copilot,
            json!({
                "sessions": [
                    {
                        "sessionId": "copilot-old",
                        "cwd": "/repo",
                        "title": "Copilot old",
                        "updatedAt": "1970-01-01T00:00:00Z"
                    }
                ]
            }),
        );
    let mut runtime = runtime(state)?;
    add_project(&mut runtime, "/repo")?;
    let response = dispatch_after_group_refresh(
        &mut runtime,
        command(
            "1",
            "sessions/grouped",
            "copilot",
            json!({
                "updatedWithinDays": null
            }),
        ),
    )?;

    assert_ok(&response)?;
    assert_group_identity(&response.result, "/repo", "cwd:/repo")?;
    let sessions = grouped_sessions(&response.result, "/repo")?;
    assert_session_ids(sessions, &["copilot-old"])
}

#[test]
fn prompt_dispatch_rejects_raw_session_id_product_path() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command(
        "1",
        "session/prompt",
        "codex",
        json!({ "session_id": "session-1", "prompt": [{ "type": "text", "text": "hello" }] }),
    ));

    assert_invalid_params(&response)?;
    if !runtime.drain_events().is_empty() {
        return Err("raw session_id prompt produced events".into());
    }
    Ok(())
}

#[test]
fn cancel_dispatch_records_cancel_without_final_state() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command(
        "1",
        "session/cancel",
        "claude",
        json!({ "session_id": "session-1" }),
    ));

    assert_ok(&response)?;
    let events = runtime.drain_events();
    if events.is_empty() {
        return Ok(());
    }
    Err(format!("cancel produced product events: {events:?}").into())
}

fn connect_count(state: &Arc<Mutex<FakeState>>, provider: ProviderId) -> TestResult<Option<usize>> {
    Ok(state
        .lock()
        .map_err(|error| format!("state poisoned: {error}"))?
        .connects
        .get(&provider)
        .copied())
}

fn dispatch_after_group_refresh(
    runtime: &mut service_runtime::ServiceRuntime<support::FakeFactory>,
    request: service_runtime::ConsumerCommand,
) -> TestResult<service_runtime::ConsumerResponse> {
    let loading = runtime.dispatch(request.clone());
    assert_ok(&loading)?;
    runtime.refresh_after_response(&request)?;
    Ok(runtime.dispatch(request))
}

fn add_project(
    runtime: &mut service_runtime::ServiceRuntime<support::FakeFactory>,
    cwd: &str,
) -> TestResult<()> {
    assert_ok(&runtime.dispatch(command(
        "add-project",
        "projects/add",
        "all",
        json!({ "cwd": cwd }),
    )))?;
    Ok(())
}

fn seed_grouped_session_lists(state: &Arc<Mutex<FakeState>>) -> TestResult<()> {
    let mut state = state.lock().map_err(|error| format!("{error}"))?;
    state.session_lists.insert(
        ProviderId::Codex,
        json!({
            "sessions": [
                {
                    "sessionId": "codex-recent",
                    "cwd": "/repo",
                    "title": "Codex recent",
                    "updatedAt": "9999-01-01T00:00:00Z"
                },
                {
                    "sessionId": "codex-other-cwd",
                    "cwd": "/other",
                    "title": "Codex other",
                    "updatedAt": "9999-01-01T00:00:00Z"
                }
            ]
        }),
    );
    state.session_lists.insert(
        ProviderId::Claude,
        json!({
            "sessions": [
                {
                    "sessionId": "claude-recent",
                    "cwd": "/repo",
                    "title": "Claude recent",
                    "updatedAt": "9999-01-02T00:00:00Z"
                }
            ]
        }),
    );
    state.session_lists.insert(
        ProviderId::Copilot,
        json!({
            "sessions": [
                {
                    "sessionId": "copilot-old",
                    "cwd": "/repo",
                    "title": "Copilot old",
                    "updatedAt": "1970-01-01T00:00:00Z"
                }
            ]
        }),
    );
    Ok(())
}

fn seed_paginated_session_lists(state: &Arc<Mutex<FakeState>>) -> TestResult<()> {
    let mut state = state.lock().map_err(|error| format!("{error}"))?;
    state.session_list_pages.insert(
        (ProviderId::Codex, Some("/repo".to_owned()), None),
        json!({
            "sessions": [session_list_row("repo-page-1", "/repo", "9999-01-01T00:00:00Z")],
            "nextCursor": "repo-page-2"
        }),
    );
    state.session_list_pages.insert(
        (
            ProviderId::Codex,
            Some("/repo".to_owned()),
            Some("repo-page-2".to_owned()),
        ),
        json!({
            "sessions": [
                session_list_row("repo-page-2", "/repo", "9999-01-02T00:00:00Z")
            ],
            "nextCursor": null
        }),
    );
    state.session_list_pages.insert(
        (ProviderId::Codex, Some("/other".to_owned()), None),
        json!({
            "sessions": [session_list_row("other-page-1", "/other", "9999-01-03T00:00:00Z")],
            "nextCursor": null
        }),
    );
    Ok(())
}

fn session_list_row(session_id: &str, cwd: &str, updated_at: &str) -> Value {
    json!({
        "sessionId": session_id,
        "cwd": cwd,
        "title": session_id,
        "updatedAt": updated_at
    })
}

fn grouped_session_group<'a>(value: &'a Value, cwd: &str) -> TestResult<&'a Value> {
    value
        .get("groups")
        .and_then(Value::as_array)
        .and_then(|groups| {
            groups
                .iter()
                .find(|group| group.get("cwd").and_then(Value::as_str) == Some(cwd))
        })
        .ok_or_else(|| format!("missing grouped session group for {cwd}: {value}").into())
}

fn grouped_sessions<'a>(value: &'a Value, cwd: &str) -> TestResult<&'a Vec<Value>> {
    grouped_session_group(value, cwd)?
        .get("sessions")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing grouped sessions for {cwd}: {value}").into())
}

fn assert_group_identity(value: &Value, cwd: &str, expected_group_id: &str) -> TestResult<()> {
    let group = grouped_session_group(value, cwd)?;
    let group_id = group
        .get("groupId")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing groupId for {cwd}: {group}"))?;
    if group_id == expected_group_id {
        return Ok(());
    }
    Err(format!("expected groupId {expected_group_id}, got {group_id}").into())
}

fn assert_group_count(value: &Value, expected: usize) -> TestResult<()> {
    let actual = value
        .get("groups")
        .and_then(Value::as_array)
        .map(Vec::len)
        .ok_or_else(|| format!("missing groups array: {value}"))?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected {expected} groups, got {actual}: {value}").into())
}

fn assert_project_cwds(value: &Value, expected: &[&str]) -> TestResult<()> {
    let actual = value
        .get("projects")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing projects array: {value}"))?
        .iter()
        .map(|project| project.get("cwd").and_then(Value::as_str))
        .collect::<Option<Vec<_>>>()
        .ok_or_else(|| format!("project row missing cwd: {value}"))?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected projects {expected:?}, got {actual:?}").into())
}

fn assert_session_ids(sessions: &[Value], expected: &[&str]) -> TestResult<()> {
    let actual = sessions
        .iter()
        .map(|session| session.get("sessionId").and_then(Value::as_str))
        .collect::<Option<Vec<_>>>()
        .ok_or("grouped session row was missing sessionId")?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected session ids {expected:?}, got {actual:?}").into())
}

fn assert_session_updated_at(
    sessions: &[Value],
    session_id: &str,
    expected_updated_at: &str,
) -> TestResult<()> {
    let session = sessions
        .iter()
        .find(|session| session.get("sessionId").and_then(Value::as_str) == Some(session_id))
        .ok_or_else(|| format!("missing session {session_id}"))?;
    if session.get("providerUpdatedAt").is_some() {
        return Err(format!("session still exposed providerUpdatedAt: {session}").into());
    }
    let updated_at = session
        .get("updatedAt")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing updatedAt for {session_id}: {session}"))?;
    if updated_at == expected_updated_at {
        return Ok(());
    }
    Err(format!("expected updatedAt {expected_updated_at}, got {updated_at}").into())
}

fn assert_invalid_params(response: &service_runtime::ConsumerResponse) -> TestResult<()> {
    if response.ok {
        return Err(format!("expected invalid_params, got ok response {response:?}").into());
    }
    let error_code = response.error.as_ref().map(|error| error.code.as_str());
    if error_code == Some("invalid_params") {
        return Ok(());
    }
    Err(format!("expected invalid_params, got {error_code:?}").into())
}
