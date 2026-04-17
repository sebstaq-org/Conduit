use super::super::FixtureProviderFactory;
use super::support::{
    SessionLoadCapture, SessionPromptCapture, TestResult, command, fixture_root, transcript_update,
    value_contains_string, write_session_load_capture, write_session_new_capture,
    write_session_prompt_capture,
};
use serde_json::{Value, json};
use service_runtime::ServiceRuntime;
use session_store::LocalStore;

#[test]
fn runtime_session_list_and_grouped_use_fixture_provider() -> TestResult<()> {
    let root = fixture_root(json!({
        "sessions": [{
            "sessionId": "session-1",
            "cwd": "/repo",
            "title": "Fixture session",
            "updatedAt": "9999-01-01T00:00:00Z"
        }],
        "nextCursor": "cursor-1"
    }))?;
    let factory = FixtureProviderFactory::load(root.path())?;
    let mut store = LocalStore::open_path(root.path().join("store.sqlite3"))?;
    store.add_project("/repo")?;
    let mut runtime = ServiceRuntime::with_factory(factory, store);

    let listed = runtime.dispatch(command("list", "session/list", "codex", json!({})));
    if listed
        .result
        .pointer("/sessions/0/sessionId")
        .and_then(Value::as_str)
        != Some("session-1")
    {
        return Err(format!("unexpected session/list result {}", listed.result).into());
    }

    runtime.force_refresh_session_index("all")?;
    let grouped = runtime.dispatch(command(
        "grouped",
        "sessions/grouped",
        "all",
        json!({ "updatedWithinDays": null }),
    ));
    if grouped
        .result
        .pointer("/groups/0/sessions/0/sessionId")
        .and_then(Value::as_str)
        != Some("session-1")
    {
        return Err(format!("unexpected sessions/grouped result {}", grouped.result).into());
    }
    Ok(())
}

#[test]
fn runtime_session_open_uses_session_load_fixture_transcript() -> TestResult<()> {
    let root = fixture_root(json!({
        "sessions": [{
            "sessionId": "session-1",
            "cwd": "/repo",
            "title": "Fixture session",
            "updatedAt": "9999-01-01T00:00:00Z"
        }]
    }))?;
    write_session_load_capture(
        root.path(),
        SessionLoadCapture {
            capture: "capture-1",
            session_id: "session-1",
            manifest_session_id: Some("session-1"),
            response: json!({ "configOptions": [], "modes": [] }),
            updates: vec![transcript_update(0, "agent_message_chunk", "loaded")],
        },
    )?;
    let factory = FixtureProviderFactory::load(root.path())?;
    let mut store = LocalStore::open_path(root.path().join("store.sqlite3"))?;
    store.add_project("/repo")?;
    let mut runtime = ServiceRuntime::with_factory(factory, store);

    let opened = runtime.dispatch(command(
        "open",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "/repo",
            "limit": 40
        }),
    ));
    if !opened.ok {
        return Err(format!("session/open failed: {opened:?}").into());
    }
    if opened.result.pointer("/sessionId").and_then(Value::as_str) != Some("session-1") {
        return Err(format!("unexpected session/open result {}", opened.result).into());
    }
    if !value_contains_string(&opened.result, "loaded") {
        return Err(format!("session/open did not expose transcript {}", opened.result).into());
    }
    Ok(())
}

#[test]
fn runtime_session_new_and_prompt_use_fixture_provider() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_new_capture(
        root.path(),
        "default",
        json!({
            "sessionId": "session-1",
            "configOptions": [],
            "modes": { "availableModes": [], "currentModeId": null },
            "models": null
        }),
    )?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "hello" })],
            response: json!({ "stopReason": "end_turn" }),
            session_id: "session-1",
            updates: vec![transcript_update(0, "agent_message_chunk", "fixture-ready")],
        },
    )?;
    let factory = FixtureProviderFactory::load(root.path())?;
    let store = LocalStore::open_path(root.path().join("store.sqlite3"))?;
    let mut runtime = ServiceRuntime::with_factory(factory, store);

    let created = runtime.dispatch(command(
        "new",
        "session/new",
        "codex",
        json!({ "cwd": "/repo", "limit": 40 }),
    ));
    if !created.ok {
        return Err(format!("session/new failed: {created:?}").into());
    }
    let open_session_id = created
        .result
        .pointer("/history/openSessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing openSessionId: {}", created.result))?;

    let prompted = runtime.dispatch(command(
        "prompt",
        "session/prompt",
        "all",
        json!({
            "openSessionId": open_session_id,
            "prompt": [{ "type": "text", "text": "hello" }]
        }),
    ));
    if !prompted.ok {
        return Err(format!("session/prompt failed: {prompted:?}").into());
    }
    let history = runtime.dispatch(command(
        "history",
        "session/history",
        "all",
        json!({ "openSessionId": open_session_id, "limit": 40 }),
    ));
    if !value_contains_string(&history.result, "fixture-ready") {
        return Err(format!("history did not expose prompt fixture {}", history.result).into());
    }
    Ok(())
}
