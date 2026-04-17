use super::super::FixtureProviderFactory;
use super::support::{
    SessionPromptCapture, TestResult, fixture_root, initialize_port, transcript_update,
    write_session_prompt_capture,
};
use acp_core::InteractionResponse;
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::{ProviderFactory, RuntimeError};
use tempfile::TempDir;

#[test]
fn session_prompt_replays_updates_and_lifecycle() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_prompt_capture(
        root.path(),
        SessionPromptCapture {
            capture: "default",
            prompt: vec![json!({ "type": "text", "text": "hello" })],
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
        port.session_set_config_option(
            "session-1".to_owned(),
            "mode".to_owned(),
            "default".to_owned(),
        ),
        "session/set_config_option",
    )?;
    assert_unsupported(
        port.session_respond_interaction(
            "session-1".to_owned(),
            "interaction-1".to_owned(),
            InteractionResponse::Cancelled,
        ),
        "session/respond_interaction",
    )
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
