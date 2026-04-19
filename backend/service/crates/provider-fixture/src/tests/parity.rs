use super::super::FixtureProviderFactory;
use super::support::{TestResult, initialize_port};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::ProviderFactory;
use std::path::{Path, PathBuf};

const PARITY_PROMPT: &str = "Reply with exactly CONDUIT_E2E_PROVIDER_PARITY_RESPONSE. Do not include private paths, credentials, account names, user names, machine names, dates, or external service details.";
const FIXTURE_CWD: &str = "/tmp/conduit-e2e-fixture-project";

#[test]
fn committed_claude_parity_fixtures_replay_prompt_config_and_load() -> TestResult<()> {
    let mut factory = parity_factory()?;
    let mut port = factory.connect(ProviderId::Claude)?;
    initialize_port(port.as_mut())?;

    let created = port.session_new(Path::new("/repo").to_path_buf())?;
    assert_json_string(
        &created,
        "/sessionId",
        "e2e-claude-new-session-0001",
        "claude session/new",
    )?;

    let listed = port.session_list(None, None)?;
    assert_listed_session(
        &listed,
        "e2e-claude-new-session-0001",
        "Claude E2E parity session",
        "claude session/list",
    )?;

    assert_prompt_requires_config(port.as_mut(), "e2e-claude-new-session-0001")?;

    let configured = port.session_set_config_option(
        "e2e-claude-new-session-0001".to_owned(),
        "model".to_owned(),
        "haiku".to_owned(),
    )?;
    assert_config_current_value(&configured, "model", "haiku", "claude set_config")?;

    let mut updates = Vec::new();
    let prompted = port.session_prompt(
        "e2e-claude-new-session-0001".to_owned(),
        vec![json!({ "type": "text", "text": PARITY_PROMPT })],
        &mut |update| updates.push(update),
    )?;
    assert_json_string(&prompted, "/stopReason", "end_turn", "claude prompt")?;
    assert_agent_text(
        &updates,
        "CONDUIT_E2E_PROVIDER_PARITY_RESPONSE",
        "claude prompt",
    )?;

    let loaded = port.session_load(
        "e2e-claude-new-session-0001".to_owned(),
        Path::new(FIXTURE_CWD).to_path_buf(),
    )?;
    assert_config_current_value(&loaded, "model", "default", "claude load")?;
    assert_loaded_agent_text(
        &port.snapshot().loaded_transcripts,
        "e2e-claude-new-session-0001",
        "CONDUIT_E2E_PROVIDER_PARITY_RESPONSE",
        "claude load",
    )?;
    Ok(())
}

#[test]
fn committed_copilot_parity_fixtures_replay_prompt_config_and_load() -> TestResult<()> {
    let mut factory = parity_factory()?;
    let mut port = factory.connect(ProviderId::Copilot)?;
    initialize_port(port.as_mut())?;

    let created = port.session_new(Path::new("/repo").to_path_buf())?;
    assert_json_string(
        &created,
        "/sessionId",
        "e2e-copilot-new-session-0001",
        "copilot session/new",
    )?;

    let listed = port.session_list(None, None)?;
    assert_listed_session(
        &listed,
        "e2e-copilot-new-session-0001",
        "Copilot E2E parity session",
        "copilot session/list",
    )?;

    let configured = port.session_set_config_option(
        "e2e-copilot-new-session-0001".to_owned(),
        "model".to_owned(),
        "gpt-4.1".to_owned(),
    )?;
    assert_config_current_value(&configured, "model", "gpt-4.1", "copilot set_config")?;

    let mut updates = Vec::new();
    let prompted = port.session_prompt(
        "e2e-copilot-new-session-0001".to_owned(),
        vec![json!({ "type": "text", "text": PARITY_PROMPT })],
        &mut |update| updates.push(update),
    )?;
    assert_json_string(&prompted, "/stopReason", "end_turn", "copilot prompt")?;
    assert_agent_text(
        &updates,
        "CONDUIT_E2E_PROVIDER_PARITY_RESPONSE",
        "copilot prompt",
    )?;

    let loaded = port.session_load(
        "e2e-copilot-new-session-0001".to_owned(),
        Path::new(FIXTURE_CWD).to_path_buf(),
    )?;
    assert_config_current_value(&loaded, "model", "gpt-4.1", "copilot load")?;
    Ok(())
}

fn assert_prompt_requires_config(
    port: &mut dyn service_runtime::ProviderPort,
    session_id: &str,
) -> TestResult<()> {
    let mut updates = Vec::new();
    let error = port
        .session_prompt(
            session_id.to_owned(),
            vec![json!({ "type": "text", "text": PARITY_PROMPT })],
            &mut |update| updates.push(update),
        )
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
    if !error.contains("requires prior session/set_config_option model=haiku") {
        return Err(format!("claude prompt did not require model=haiku prelude: {error}").into());
    }
    if !updates.is_empty() {
        return Err("claude prompt emitted updates before required config".into());
    }
    Ok(())
}

fn parity_factory() -> TestResult<FixtureProviderFactory> {
    let root = repo_root()?.join("apps/e2e/fixtures/provider");
    Ok(FixtureProviderFactory::load(&root)?)
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

fn assert_json_string(
    value: &Value,
    pointer: &str,
    expected: &str,
    context: &str,
) -> TestResult<()> {
    let actual = value.pointer(pointer).and_then(Value::as_str);
    if actual != Some(expected) {
        return Err(format!("{context} expected {pointer}={expected}, got {value}").into());
    }
    Ok(())
}

fn assert_listed_session(
    value: &Value,
    expected_session_id: &str,
    expected_title: &str,
    context: &str,
) -> TestResult<()> {
    let sessions = value
        .get("sessions")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("{context} missing sessions array: {value}"))?;
    if sessions.len() != 1 {
        return Err(format!("{context} expected exactly one session, got {value}").into());
    }
    let session = &sessions[0];
    assert_json_string(
        session,
        "/sessionId",
        expected_session_id,
        &format!("{context} session id"),
    )?;
    assert_json_string(session, "/cwd", FIXTURE_CWD, &format!("{context} cwd"))?;
    assert_json_string(
        session,
        "/title",
        expected_title,
        &format!("{context} title"),
    )?;
    if session.get("updatedAt").and_then(Value::as_str).is_none() {
        return Err(format!("{context} missing updatedAt: {value}").into());
    }
    Ok(())
}

fn assert_agent_text(
    updates: &[acp_core::TranscriptUpdateSnapshot],
    expected: &str,
    context: &str,
) -> TestResult<()> {
    let actual = updates
        .iter()
        .filter(|update| update.variant == "agent_message_chunk")
        .filter_map(|update| {
            update
                .update
                .get("content")
                .and_then(|content| content.get("text"))
                .and_then(Value::as_str)
        })
        .collect::<String>();
    if actual != expected {
        return Err(format!("{context} expected agent text {expected}, got {actual}").into());
    }
    Ok(())
}

fn assert_loaded_agent_text(
    transcripts: &[acp_core::LoadedTranscriptSnapshot],
    session_id: &str,
    expected: &str,
    context: &str,
) -> TestResult<()> {
    let transcript = transcripts
        .iter()
        .find(|transcript| transcript.identity.acp_session_id == session_id)
        .ok_or_else(|| format!("{context} did not load transcript {session_id}"))?;
    assert_agent_text(&transcript.updates, expected, context)
}

fn assert_config_current_value(
    value: &Value,
    config_id: &str,
    expected: &str,
    context: &str,
) -> TestResult<()> {
    let options = value
        .get("configOptions")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("{context} missing configOptions: {value}"))?;
    let option = options
        .iter()
        .find(|option| option.get("id").and_then(Value::as_str) == Some(config_id))
        .ok_or_else(|| format!("{context} missing {config_id} config option: {value}"))?;
    if option.get("currentValue").and_then(Value::as_str) != Some(expected) {
        return Err(format!("{context} expected {config_id}={expected}, got {value}").into());
    }
    Ok(())
}
