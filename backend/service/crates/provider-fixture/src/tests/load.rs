use super::super::FixtureProviderFactory;
use super::support::{
    SessionLoadCapture, TestResult, fixture_root, initialize_port, transcript_update,
    write_session_load_capture,
};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::ProviderFactory;
use std::fs::{create_dir_all, write};

#[test]
fn session_load_indexes_capture_with_manifest_session_id() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
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
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;

    let response = port.session_load("session-1".to_owned(), "/repo".into())?;
    if response
        .pointer("/configOptions")
        .and_then(Value::as_array)
        .is_none()
    {
        return Err(format!("unexpected session/load response {response}").into());
    }
    let snapshot = port.snapshot();
    if snapshot
        .loaded_transcripts
        .first()
        .and_then(|transcript| transcript.updates.first())
        .map(|update| update.variant.as_str())
        != Some("agent_message_chunk")
    {
        return Err(format!("unexpected snapshot {snapshot:?}").into());
    }
    Ok(())
}

#[test]
fn session_load_indexes_capture_from_loaded_transcript_identity() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_load_capture(
        root.path(),
        SessionLoadCapture {
            capture: "capture-1",
            session_id: "session-1",
            manifest_session_id: None,
            response: json!({ "configOptions": [] }),
            updates: Vec::new(),
        },
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;

    let response = port.session_load("session-1".to_owned(), "/repo".into())?;
    if response
        .pointer("/configOptions")
        .and_then(Value::as_array)
        .is_some()
    {
        return Ok(());
    }
    Err(format!("unexpected session/load response {response}").into())
}

#[test]
fn duplicate_session_load_fixture_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    for capture in ["capture-1", "capture-2"] {
        write_session_load_capture(
            root.path(),
            SessionLoadCapture {
                capture,
                session_id: "session-1",
                manifest_session_id: Some("session-1"),
                response: json!({ "configOptions": [] }),
                updates: Vec::new(),
            },
        )?;
    }
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("duplicate session/load fixture unexpectedly loaded")?;

    if !error
        .to_string()
        .contains("duplicate session/load session id")
    {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn missing_session_load_fixture_fails_explicitly() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let error = port
        .session_load("missing-session".to_owned(), "/repo".into())
        .err()
        .ok_or("missing session/load unexpectedly succeeded")?;

    if !error.to_string().contains("missing session/load fixture") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn malformed_session_load_fixture_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let dir = root.path().join("codex/session-load/capture-1");
    create_dir_all(&dir)?;
    write(dir.join("provider.raw.json"), "{}")?;
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("malformed session/load fixture unexpectedly loaded")?;

    if !error.to_string().contains("response field") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}
