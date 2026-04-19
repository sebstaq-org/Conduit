use super::super::FixtureProviderFactory;
use super::support::{TestResult, initialize_port};
use acp_discovery::ProviderId;
use serde_json::{Value, json};
use service_runtime::ProviderFactory;
use std::path::Path;

const PARITY_PROMPT: &str = "Reply with exactly CONDUIT_E2E_PROVIDER_PARITY_RESPONSE. Do not include private paths, credentials, account names, user names, machine names, dates, or external service details.";

#[test]
fn committed_claude_parity_fixtures_replay_session_new_and_config() -> TestResult<()> {
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
    if listed != json!({ "sessions": [] }) {
        return Err(format!("unexpected claude session/list fixture: {listed}").into());
    }

    let configured = port.session_set_config_option(
        "e2e-claude-new-session-0001".to_owned(),
        "model".to_owned(),
        "haiku".to_owned(),
    )?;
    assert_config_current_value(&configured, "model", "haiku", "claude set_config")?;
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
    if updates.is_empty() {
        return Err("copilot prompt fixture did not replay updates".into());
    }

    let loaded = port.session_load(
        "e2e-copilot-new-session-0001".to_owned(),
        Path::new("/repo").to_path_buf(),
    )?;
    assert_config_current_value(&loaded, "model", "gpt-4.1", "copilot load")?;
    Ok(())
}

fn parity_factory() -> TestResult<FixtureProviderFactory> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../apps/e2e/fixtures/provider");
    Ok(FixtureProviderFactory::load(&root)?)
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
