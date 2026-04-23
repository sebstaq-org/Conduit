use super::super::FixtureProviderFactory;
use super::support::{TestResult, fixture_root, initialize_port, write_initialize_capture};
use acp_core::ProviderInitializeRequest;
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::ProviderFactory;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

#[test]
fn codex_session_list_returns_raw_fixture() -> TestResult<()> {
    let root = fixture_root(json!({
        "sessions": [{ "sessionId": "session-1", "cwd": "/repo" }],
        "nextCursor": "cursor-1"
    }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let response = port.session_list(None, None)?;

    if response.get("nextCursor").and_then(Value::as_str) != Some("cursor-1") {
        return Err(format!("unexpected response {response}").into());
    }
    Ok(())
}

#[test]
fn cursor_pages_terminate_after_raw_fixture_page() -> TestResult<()> {
    let root = fixture_root(json!({
        "sessions": [{ "sessionId": "session-1", "cwd": "/repo" }],
        "nextCursor": "cursor-1"
    }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    initialize_port(port.as_mut())?;
    let response = port.session_list(None, Some("cursor-1".to_owned()))?;

    if response != json!({ "sessions": [] }) {
        return Err(format!("unexpected cursor response {response}").into());
    }
    Ok(())
}

#[test]
fn missing_provider_fixture_returns_empty_session_list() -> TestResult<()> {
    let root = TempDir::new()?;
    write_initialize_capture(root.path(), ProviderId::Claude, "default")?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Claude)?;
    initialize_port(port.as_mut())?;
    let response = port.session_list(None, None)?;

    if response != json!({ "sessions": [] }) {
        return Err(format!("unexpected response {response}").into());
    }
    Ok(())
}

#[test]
fn malformed_session_list_fixture_fails_load() -> TestResult<()> {
    let root = fixture_root(json!({ "nextCursor": null }))?;
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("malformed fixture unexpectedly loaded")?;

    if !error.to_string().contains("sessions array") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn initialize_uses_raw_fixture_and_sets_snapshot_ready() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;

    if port.snapshot().connection_state != acp_core::ConnectionState::Connected {
        return Err("fixture provider should start connected before initialize".into());
    }
    let result = initialize_port(port.as_mut())?;
    if result.request.method != "initialize" {
        return Err(format!("unexpected initialize result {result:?}").into());
    }
    let snapshot = port.snapshot();
    if snapshot.connection_state != acp_core::ConnectionState::Ready {
        return Err(format!("unexpected snapshot state {:?}", snapshot.connection_state).into());
    }
    if !snapshot.capabilities.is_object() {
        return Err(format!("unexpected capabilities {}", snapshot.capabilities).into());
    }
    Ok(())
}

#[test]
fn committed_initialize_fixtures_replay_for_all_providers() -> TestResult<()> {
    let root = repo_root()?.join("apps/e2e/fixtures/provider");
    let mut factory = FixtureProviderFactory::load(&root)?;

    for (provider, expected_name) in [
        (ProviderId::Claude, "@agentclientprotocol/claude-agent-acp"),
        (ProviderId::Copilot, "Copilot"),
        (ProviderId::Codex, "codex-acp"),
    ] {
        let mut port = factory.connect(provider)?;
        let result = initialize_port(port.as_mut())?;
        let value = serde_json::to_value(&result)?;

        if value.pointer("/request/method").and_then(Value::as_str) != Some("initialize") {
            return Err(format!("unexpected initialize request for {provider}").into());
        }
        if value
            .pointer("/response/agentInfo/name")
            .and_then(Value::as_str)
            != Some(expected_name)
        {
            return Err(format!("unexpected initialize agentInfo for {provider}: {value}").into());
        }
        if value
            .pointer("/response/agentCapabilities/loadSession")
            .and_then(Value::as_bool)
            != Some(true)
        {
            return Err(format!("missing loadSession capability for {provider}: {value}").into());
        }
    }

    Ok(())
}

fn repo_root() -> TestResult<PathBuf> {
    let cwd = std::env::current_dir()?;
    if let Some(root) = discover_repo_root(&cwd) {
        return Ok(root);
    }

    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    discover_repo_root(manifest_dir).ok_or_else(|| "could not resolve repository root".into())
}

fn discover_repo_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|candidate| {
            candidate.join("package.json").is_file()
                && candidate.join("backend/service/Cargo.toml").is_file()
        })
        .map(Path::to_path_buf)
}

#[test]
fn missing_initialize_fixture_fails_explicitly() -> TestResult<()> {
    let root = TempDir::new()?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    let error = port
        .initialize(ProviderInitializeRequest::conduit_default())
        .err()
        .ok_or("missing initialize unexpectedly succeeded")?;

    if !error.to_string().contains("missing initialize fixture") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn session_operation_before_initialize_fails_explicitly() -> TestResult<()> {
    let root = fixture_root(json!({ "sessions": [] }))?;
    let mut factory = FixtureProviderFactory::load(root.path())?;
    let mut port = factory.connect(ProviderId::Codex)?;
    let error = port
        .session_list(None, None)
        .err()
        .ok_or("session/list before initialize unexpectedly succeeded")?;

    if !error.to_string().contains("requires initialize fixture") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}

#[test]
fn duplicate_initialize_fixture_fails_load() -> TestResult<()> {
    let root = TempDir::new()?;
    for capture in ["capture-1", "capture-2"] {
        write_initialize_capture(root.path(), ProviderId::Codex, capture)?;
    }
    let error = FixtureProviderFactory::load(root.path())
        .err()
        .ok_or("duplicate initialize fixture unexpectedly loaded")?;

    if !error.to_string().contains("duplicate initialize fixture") {
        return Err(format!("unexpected error {error}").into());
    }
    Ok(())
}
