//! Integration tests for ACP session config state projection.

mod support;

use app_api as _;
use acp_core::TranscriptUpdateSnapshot;
use serde as _;
use serde_json::json;
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn set_config_option_updates_open_session_state_projection() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let opened = runtime.dispatch(command(
        "1",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "/repo",
            "limit": 32
        }),
    ));
    assert_ok(&opened)?;
    let open_session_id = opened
        .result
        .get("openSessionId")
        .and_then(serde_json::Value::as_str)
        .ok_or("session/open missing openSessionId")?;
    let configured = runtime.dispatch(command(
        "2",
        "session/set_config_option",
        "codex",
        json!({
            "sessionId": "session-1",
            "configId": "model",
            "value": "gpt-5.4"
        }),
    ));
    assert_ok(&configured)?;
    let reopened = runtime.dispatch(command(
        "3",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "/repo",
            "limit": 32
        }),
    ));
    assert_ok(&reopened)?;
    if reopened
        .result
        .get("openSessionId")
        .and_then(serde_json::Value::as_str)
        != Some(open_session_id)
    {
        return Err("session/open changed openSessionId after set_config_option".into());
    }
    if reopened.result.get("configOptions") == Some(&json!([])) {
        return Ok(());
    }
    Err(format!(
        "session/open did not project updated configOptions: {}",
        reopened.result
    )
    .into())
}

#[test]
fn config_option_update_during_prompt_updates_open_session_state_projection() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    {
        let mut locked = state.lock().map_err(|error| format!("{error}"))?;
        locked.prompt_updates.insert(
            (acp_discovery::ProviderId::Codex, "session-1".to_owned()),
            vec![TranscriptUpdateSnapshot {
                index: 0,
                variant: "config_option_update".to_owned(),
                update: json!({
                    "sessionUpdate": "config_option_update",
                    "configOptions": [{
                        "id": "model",
                        "name": "Model",
                        "type": "string",
                        "currentValue": "gpt-5.4",
                        "options": [{
                            "value": "gpt-5.4",
                            "name": "GPT-5.4"
                        }]
                    }]
                }),
            }],
        );
    }
    let mut runtime = runtime(state)?;
    let opened = runtime.dispatch(command(
        "1",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "/repo",
            "limit": 32
        }),
    ));
    assert_ok(&opened)?;
    let open_session_id = opened
        .result
        .get("openSessionId")
        .and_then(serde_json::Value::as_str)
        .ok_or("session/open missing openSessionId")?;
    let prompted = runtime.dispatch(command(
        "2",
        "session/prompt",
        "all",
        json!({
            "openSessionId": open_session_id,
            "prompt": [{
                "type": "text",
                "text": "hi"
            }]
        }),
    ));
    assert_ok(&prompted)?;
    let reopened = runtime.dispatch(command(
        "3",
        "session/open",
        "codex",
        json!({
            "sessionId": "session-1",
            "cwd": "/repo",
            "limit": 32
        }),
    ));
    assert_ok(&reopened)?;
    let Some(config_options) = reopened.result.get("configOptions") else {
        return Err(format!("session/open missing configOptions: {}", reopened.result).into());
    };
    let current = config_options
        .as_array()
        .and_then(|entries| entries.first())
        .and_then(|entry| entry.get("currentValue"))
        .and_then(serde_json::Value::as_str);
    if current == Some("gpt-5.4") {
        return Ok(());
    }
    Err(format!(
        "session/open did not apply config_option_update projection: {}",
        reopened.result
    )
    .into())
}
