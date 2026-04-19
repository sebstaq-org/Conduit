use super::super::FixtureProviderFactory;
use super::support::{
    SessionPromptCapture, SessionSetConfigOptionCapture, TestResult, config_options, fixture_root,
    initialize_port, transcript_update, write_session_prompt_capture,
    write_session_set_config_option_capture,
};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, RuntimeError};
use std::fs::{create_dir_all, write};
use tempfile::TempDir;

#[test]
fn session_prompt_replays_updates_and_lifecycle() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "hello" })],
            required_config: None,
            response: json!({ "stopReason": "end_turn" }),
            session_id: "session-1",
            updates: vec![transcript_update(0, "agent_message_chunk", "reply")],
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let mut updates = Vec::new();

    let response = port.session_prompt(
        "session-1".to_owned(),
        vec![json!({ "type": "text", "text": "hello" })],
        &mut |update| updates.push(update),
    )?;

    if response.get("stopReason").and_then(Value::as_str) != Some("end_turn") {
        return Err(format!("unexpected response {response}").into());
    }
    if updates.first().map(|update| update.variant.as_str()) != Some("agent_message_chunk") {
        return Err(format!("unexpected updates {updates:?}").into());
    }
    if port
        .snapshot()
        .last_prompt
        .and_then(|prompt| prompt.agent_text_chunks.first().cloned())
        .as_deref()
        != Some("reply")
    {
        return Err("expected prompt lifecycle agent text chunk".into());
    }
    Ok(())
}

#[test]
fn session_prompt_rejects_prompt_mismatch() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "expected" })],
            required_config: None,
            response: json!({ "stopReason": "end_turn" }),
            session_id: "session-1",
            updates: Vec::new(),
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let error = port
        .session_prompt(
            "session-1".to_owned(),
            vec![json!({ "type": "text", "text": "actual" })],
            &mut |_| {},
        )
        .err()
        .ok_or("prompt mismatch unexpectedly succeeded")?;

    if !error.to_string().contains("prompt mismatch") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn session_prompt_failure_fixture_returns_provider_error() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let dir = root.path().join("codex/session-prompt/session-1/default");
    create_dir_all(&dir)?;
    write(
        dir.join("failure.json"),
        serde_json::to_string(&json!({
            "message": "fixture forced session/prompt failure",
            "operation": "session/prompt",
            "promptRequest": {
                "prompt": [{ "type": "text", "text": "hello" }],
                "sessionId": "session-1"
            }
        }))?,
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let error = port
        .session_prompt(
            "session-1".to_owned(),
            vec![json!({ "type": "text", "text": "hello" })],
            &mut |_| {},
        )
        .err()
        .ok_or("session/prompt failure fixture unexpectedly succeeded")?;

    if !error
        .to_string()
        .contains("fixture forced session/prompt failure")
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn session_prompt_requires_config_prelude_when_fixture_declares_it() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "hello" })],
            required_config: Some(("collaboration_mode", "plan")),
            response: json!({ "stopReason": "end_turn" }),
            session_id: "session-1",
            updates: Vec::new(),
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let error = port
        .session_prompt(
            "session-1".to_owned(),
            vec![json!({ "type": "text", "text": "hello" })],
            &mut |_| {},
        )
        .err()
        .ok_or("session/prompt unexpectedly succeeded without config prelude")?;

    if !error
        .to_string()
        .contains("requires prior session/set_config_option collaboration_mode=plan")
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn session_prompt_rejects_wrong_config_prelude_value() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_set_config_option_capture(
        root.path(),
        SessionSetConfigOptionCapture {
            capture: "default",
            config_id: "collaboration_mode",
            response: json!({ "configOptions": config_options("default") }),
            session_id: "session-1",
            value: "default",
        },
    )?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "hello" })],
            required_config: Some(("collaboration_mode", "plan")),
            response: json!({ "stopReason": "end_turn" }),
            session_id: "session-1",
            updates: Vec::new(),
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;

    let _response = port.session_set_config_option(
        "session-1".to_owned(),
        "collaboration_mode".to_owned(),
        "default".to_owned(),
    )?;
    let error = port
        .session_prompt(
            "session-1".to_owned(),
            vec![json!({ "type": "text", "text": "hello" })],
            &mut |_| {},
        )
        .err()
        .ok_or("session/prompt unexpectedly succeeded with wrong config value")?;

    if !error
        .to_string()
        .contains("requires prior session/set_config_option collaboration_mode=plan")
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn session_prompt_replays_after_required_config_prelude() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_set_config_option_capture(
        root.path(),
        SessionSetConfigOptionCapture {
            capture: "plan",
            config_id: "collaboration_mode",
            response: json!({ "configOptions": config_options("plan") }),
            session_id: "session-1",
            value: "plan",
        },
    )?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "hello" })],
            required_config: Some(("collaboration_mode", "plan")),
            response: json!({ "stopReason": "end_turn" }),
            session_id: "session-1",
            updates: vec![transcript_update(0, "agent_message_chunk", "plan-ready")],
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;

    let _response = port.session_set_config_option(
        "session-1".to_owned(),
        "collaboration_mode".to_owned(),
        "plan".to_owned(),
    )?;
    let mut updates = Vec::new();
    let response = port.session_prompt(
        "session-1".to_owned(),
        vec![json!({ "type": "text", "text": "hello" })],
        &mut |update| updates.push(update),
    )?;

    if response.get("stopReason").and_then(Value::as_str) != Some("end_turn") {
        return Err(format!("unexpected response {response}").into());
    }
    if !updates
        .iter()
        .any(|update| super::support::value_contains_string(&update.update, "plan-ready"))
    {
        return Err(format!("expected plan update, got {updates:?}").into());
    }
    Ok(())
}

#[test]
fn fixture_root_must_exist() -> TestResult<()> {
    let root = TempDir::new()?;
    let missing = root.path().join("missing");
    let error = FixtureProviderFactory::load(&missing)
        .err()
        .ok_or("missing fixture root unexpectedly loaded")?;

    if !error.to_string().contains("existing directory") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn unsupported_methods_return_unsupported_command() -> TestResult<()> {
    let root = TempDir::new()?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;

    assert_unsupported(
        port.session_cancel("session-1".to_owned()),
        "session/cancel",
    )?;
    assert_unsupported(
        port.session_respond_interaction(
            "session-1".to_owned(),
            "interaction-1".to_owned(),
            acp_core::InteractionResponse::Cancelled,
        ),
        "session/respond_interaction",
    )
}

#[test]
fn session_set_config_option_returns_matching_fixture() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_set_config_option_capture(
        root.path(),
        SessionSetConfigOptionCapture {
            capture: "plan",
            config_id: "collaboration_mode",
            response: json!({ "configOptions": config_options("plan") }),
            session_id: "session-1",
            value: "plan",
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;

    let response = port.session_set_config_option(
        "session-1".to_owned(),
        "collaboration_mode".to_owned(),
        "plan".to_owned(),
    )?;

    if response
        .pointer("/configOptions/0/currentValue")
        .and_then(Value::as_str)
        != Some("plan")
    {
        return Err(format!("unexpected response {response}").into());
    }
    Ok(())
}

#[test]
fn session_set_config_option_fails_when_fixture_is_missing() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let error = port
        .session_set_config_option(
            "session-1".to_owned(),
            "collaboration_mode".to_owned(),
            "plan".to_owned(),
        )
        .err()
        .ok_or("missing session/set_config_option unexpectedly succeeded")?;

    if !error
        .to_string()
        .contains("missing session/set_config_option")
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn malformed_session_set_config_option_without_request_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_raw_set_config_fixture(
        root.path(),
        json!({
            "configResponse": { "configOptions": config_options("plan") }
        }),
    )?;
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("malformed session/set_config_option unexpectedly loaded")?;

    if !error.to_string().contains("configRequest string fields") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn malformed_session_set_config_option_without_options_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_raw_set_config_fixture(
        root.path(),
        json!({
            "configRequest": {
                "sessionId": "session-1",
                "configId": "collaboration_mode",
                "value": "plan"
            },
            "configResponse": {}
        }),
    )?;
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("malformed session/set_config_option unexpectedly loaded")?;

    if !error
        .to_string()
        .contains("configResponse.configOptions array")
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn malformed_session_set_config_option_current_value_mismatch_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_set_config_option_capture(
        root.path(),
        SessionSetConfigOptionCapture {
            capture: "plan",
            config_id: "collaboration_mode",
            response: json!({ "configOptions": config_options("default") }),
            session_id: "session-1",
            value: "plan",
        },
    )?;
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("mismatched session/set_config_option unexpectedly loaded")?;

    if !error.to_string().contains("selected config currentValue") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

fn write_raw_set_config_fixture(root: &std::path::Path, value: Value) -> TestResult<()> {
    let dir = root.join("codex/session-set-config-option/session-1/plan");
    create_dir_all(&dir)?;
    write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&value)?,
    )?;
    Ok(())
}

fn assert_unsupported(result: service_runtime::Result<Value>, command: &str) -> TestResult<()> {
    let error = result
        .err()
        .ok_or_else(|| format!("{command} unexpectedly succeeded"))?;
    if !matches!(error, RuntimeError::UnsupportedCommand(ref error_command) if error_command == command)
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}
