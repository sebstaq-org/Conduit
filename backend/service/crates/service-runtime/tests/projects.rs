//! Project read-model tests for the consumer runtime manager.

mod support;

use acp_discovery::ProviderId;
use app_api as _;
use serde as _;
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

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
    assert_project_display_name(&listed.result, "/repo", "repo")?;

    let with_project = dispatch_after_group_refresh(
        &mut runtime,
        command("grouped", "sessions/grouped", "all", json!({})),
    )?;
    assert_ok(&with_project)?;
    assert_group_identity(&with_project.result, "/repo", "cwd:/repo")?;
    assert_group_display_name(&with_project.result, "/repo", "repo")?;

    assert_ok(&runtime.dispatch(command(
        "remove",
        "projects/remove",
        "all",
        json!({ "projectId": "cwd:/repo" }),
    )))?;
    let removed = runtime.dispatch(command("removed", "sessions/grouped", "all", json!({})));
    assert_ok(&removed)?;
    assert_group_count(&removed.result, 0)?;
    let repeated_remove = runtime.dispatch(command(
        "remove-again",
        "projects/remove",
        "all",
        json!({ "projectId": "cwd:/repo" }),
    ));
    assert_invalid_params(&repeated_remove)
}

#[test]
fn projects_update_changes_display_name_only() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    add_project(&mut runtime, "/repo")?;
    let response = runtime.dispatch(command(
        "update",
        "projects/update",
        "all",
        json!({ "projectId": "cwd:/repo", "displayName": " Repo UI " }),
    ));

    assert_ok(&response)?;
    assert_project_cwds(&response.result, &["/repo"])?;
    assert_project_display_name(&response.result, "/repo", "Repo UI")?;

    let rejected = runtime.dispatch(command(
        "empty",
        "projects/update",
        "all",
        json!({ "projectId": "cwd:/repo", "displayName": " " }),
    ));
    assert_invalid_params(&rejected)
}

#[test]
fn grouped_sessions_includes_projects_without_matching_sessions() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_list_pages
        .insert(
            (ProviderId::Codex, Some("/repo".to_owned()), None),
            json!({
                "sessions": [session_list_row("repo-page-1", "/repo", "9999-01-01T00:00:00Z")]
            }),
        );
    let mut runtime = runtime(state)?;
    add_project(&mut runtime, "/empty")?;
    add_project(&mut runtime, "/repo")?;
    let response = dispatch_after_group_refresh(
        &mut runtime,
        command("grouped", "sessions/grouped", "all", json!({})),
    )?;

    assert_ok(&response)?;
    assert_group_identity(&response.result, "/empty", "cwd:/empty")?;
    assert_group_display_name(&response.result, "/empty", "empty")?;
    assert_session_ids(grouped_sessions(&response.result, "/empty")?, &[])?;
    assert_group_identity(&response.result, "/repo", "cwd:/repo")
}

#[test]
fn grouped_sessions_includes_project_when_only_old_sessions_match_cwd() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_lists
        .insert(
            ProviderId::Copilot,
            json!({
                "sessions": [
                    session_list_row("old-only", "/old", "1970-01-01T00:00:00Z")
                ]
            }),
        );
    let mut runtime = runtime(state)?;
    add_project(&mut runtime, "/old")?;
    let response = dispatch_after_group_refresh(
        &mut runtime,
        command("grouped", "sessions/grouped", "all", json!({})),
    )?;

    assert_ok(&response)?;
    assert_group_identity(&response.result, "/old", "cwd:/old")?;
    assert_session_ids(grouped_sessions(&response.result, "/old")?, &[])
}

#[test]
fn projects_suggestions_read_cached_addable_cwds() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    seed_grouped_session_lists(&state)?;
    let mut runtime = runtime(Arc::clone(&state))?;

    runtime.refresh_project_suggestions()?;
    add_project(&mut runtime, "/repo")?;
    let response = runtime.dispatch(command(
        "suggest",
        "projects/suggestions",
        "all",
        json!({ "query": "oth", "limit": 10 }),
    ));

    assert_ok(&response)?;
    assert_project_suggestion_cwds(&response.result, &["/other"])?;
    let requests = state
        .lock()
        .map_err(|error| format!("{error}"))?
        .session_list_requests
        .clone();
    let expected = vec![
        (ProviderId::Claude, None, None),
        (ProviderId::Copilot, None, None),
        (ProviderId::Codex, None, None),
    ];
    if requests != expected {
        return Err(
            format!("expected suggestion refresh requests {expected:?}, got {requests:?}").into(),
        );
    }
    Ok(())
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
                session_list_row("codex-recent", "/repo", "9999-01-01T00:00:00Z"),
                session_list_row("codex-other-cwd", "/other", "9999-01-01T00:00:00Z")
            ]
        }),
    );
    state.session_lists.insert(
        ProviderId::Claude,
        json!({
            "sessions": [
                session_list_row("claude-recent", "/repo", "9999-01-02T00:00:00Z")
            ]
        }),
    );
    state.session_lists.insert(
        ProviderId::Copilot,
        json!({
            "sessions": [
                session_list_row("copilot-old", "/repo", "1970-01-01T00:00:00Z")
            ]
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

fn assert_project_display_name(value: &Value, cwd: &str, expected: &str) -> TestResult<()> {
    let project = value
        .get("projects")
        .and_then(Value::as_array)
        .and_then(|projects| {
            projects
                .iter()
                .find(|project| project.get("cwd").and_then(Value::as_str) == Some(cwd))
        })
        .ok_or_else(|| format!("missing project {cwd}: {value}"))?;
    let display_name = project
        .get("displayName")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing displayName for {cwd}: {project}"))?;
    if display_name == expected {
        return Ok(());
    }
    Err(format!("expected displayName {expected}, got {display_name}").into())
}

fn assert_project_suggestion_cwds(value: &Value, expected: &[&str]) -> TestResult<()> {
    let actual = value
        .get("suggestions")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing suggestions array: {value}"))?
        .iter()
        .map(|project| project.get("cwd").and_then(Value::as_str))
        .collect::<Option<Vec<_>>>()
        .ok_or_else(|| format!("suggestion row missing cwd: {value}"))?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected suggestions {expected:?}, got {actual:?}").into())
}

fn assert_group_display_name(value: &Value, cwd: &str, expected: &str) -> TestResult<()> {
    let group = grouped_session_group(value, cwd)?;
    let display_name = group
        .get("displayName")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing displayName for {cwd}: {group}"))?;
    if display_name == expected {
        return Ok(());
    }
    Err(format!("expected group displayName {expected}, got {display_name}").into())
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
