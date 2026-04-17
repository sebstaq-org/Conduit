use super::super::FixtureProviderFactory;
use super::support::{TestResult, fixture_root, initialize_port, write_session_new_capture};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::ProviderFactory;

#[test]
fn codex_session_new_returns_raw_fixture() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_new_capture(
        root.path(),
        "capture-1",
        json!({
            "sessionId": "session-1",
            "configOptions": [],
            "modes": { "availableModes": [], "currentModeId": null },
            "models": null
        }),
    )?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let response = port.session_new("/repo".into())?;

    if response.get("sessionId").and_then(Value::as_str) != Some("session-1") {
        return Err(format!("unexpected response {response}").into());
    }
    Ok(())
}

#[test]
fn missing_session_new_fixture_fails_explicitly() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let error = port
        .session_new("/repo".into())
        .err()
        .ok_or("missing session/new unexpectedly succeeded")?;

    if !error.to_string().contains("missing session/new fixture") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn duplicate_session_new_fixture_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    for capture in ["capture-1", "capture-2"] {
        write_session_new_capture(root.path(), capture, json!({ "sessionId": capture }))?;
    }
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("duplicate session/new fixture unexpectedly loaded")?;

    if !error.to_string().contains("duplicate session/new fixture") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn malformed_session_new_fixture_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    write_session_new_capture(root.path(), "capture-1", json!({ "models": null }))?;
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("malformed session/new fixture unexpectedly loaded")?;

    if !error.to_string().contains("sessionId string") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}
