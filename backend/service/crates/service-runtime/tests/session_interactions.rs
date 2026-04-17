//! Integration tests for backend interaction responses during prompt turns.

mod support;

use app_api as _;
#[cfg(feature = "benchmarks")]
use criterion as _;
use schemars as _;
use serde as _;
use serde_json::json;
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn respond_interaction_forwards_selected_payload_to_provider() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state))?;
    let created = runtime.dispatch(command(
        "new-1",
        "session/new",
        "codex",
        json!({ "cwd": "/repo" }),
    ));
    assert_ok(&created)?;
    let open_session_id = created
        .result
        .get("history")
        .and_then(|history| history.get("openSessionId"))
        .and_then(serde_json::Value::as_str)
        .ok_or("session/new missing openSessionId")?
        .to_owned();

    let responded = runtime.dispatch(command(
        "respond-1",
        "session/respond_interaction",
        "all",
        json!({
            "openSessionId": open_session_id,
            "interactionId": "interaction-1",
            "response": {
                "kind": "selected",
                "optionId": "answer-0"
            }
        }),
    ));

    assert_ok(&responded)?;
    let recorded = state
        .lock()
        .map_err(|error| format!("{error}"))?
        .interaction_responses
        .clone();
    if recorded
        == vec![(
            acp_discovery::ProviderId::Codex,
            "session-1".to_owned(),
            "interaction-1".to_owned(),
            json!({
                "kind": "selected",
                "optionId": "answer-0"
            }),
        )]
    {
        return Ok(());
    }
    Err(format!("unexpected recorded interaction responses: {recorded:?}").into())
}

#[test]
fn respond_interaction_rejects_unknown_open_session() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;

    let response = runtime.dispatch(command(
        "respond-1",
        "session/respond_interaction",
        "all",
        json!({
            "openSessionId": "missing-open-session",
            "interactionId": "interaction-1",
            "response": {
                "kind": "cancel"
            }
        }),
    ));

    let code = response.error.as_ref().map(|error| error.code.as_str());
    if !response.ok && code == Some("invalid_params") {
        return Ok(());
    }
    Err(format!("expected invalid_params for unknown open session: {response:?}").into())
}

#[test]
fn respond_interaction_requires_provider_all() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;

    let response = runtime.dispatch(command(
        "respond-1",
        "session/respond_interaction",
        "codex",
        json!({
            "openSessionId": "open-session-1",
            "interactionId": "interaction-1",
            "response": {
                "kind": "cancel"
            }
        }),
    ));

    let code = response.error.as_ref().map(|error| error.code.as_str());
    if !response.ok && code == Some("invalid_params") {
        return Ok(());
    }
    Err(format!("expected invalid_params for non-global provider: {response:?}").into())
}

#[test]
fn respond_interaction_answer_other_defaults_option_id() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(Arc::clone(&state))?;
    let created = runtime.dispatch(command(
        "new-1",
        "session/new",
        "codex",
        json!({ "cwd": "/repo" }),
    ));
    assert_ok(&created)?;
    let open_session_id = created
        .result
        .get("history")
        .and_then(|history| history.get("openSessionId"))
        .and_then(serde_json::Value::as_str)
        .ok_or("session/new missing openSessionId")?
        .to_owned();

    let responded = runtime.dispatch(command(
        "respond-1",
        "session/respond_interaction",
        "all",
        json!({
            "openSessionId": open_session_id,
            "interactionId": "interaction-2",
            "response": {
                "kind": "answer_other",
                "questionId": "plan_target",
                "text": "custom plan target"
            }
        }),
    ));

    assert_ok(&responded)?;
    let recorded = state
        .lock()
        .map_err(|error| format!("{error}"))?
        .interaction_responses
        .clone();
    if recorded.iter().any(|entry| {
        entry.2 == "interaction-2"
            && entry.3
                == json!({
                    "kind": "answer_other",
                    "optionId": "answer-other",
                    "questionId": "plan_target",
                    "text": "custom plan target"
                })
    }) {
        return Ok(());
    }
    Err(format!("answer_other payload was not normalized: {recorded:?}").into())
}
