use super::super::FixtureProviderFactory;
use acp_core::{ProviderInitializeRequest, ProviderInitializeResponse, ProviderInitializeResult};
use acp_discovery::ProviderId;
use agent_client_protocol_schema::{AgentCapabilities, Implementation, ProtocolVersion};
use serde_json::{Value, json};
use service_runtime::{ConsumerCommand, ProviderPort};
use std::fs::{create_dir_all, write};
use tempfile::TempDir;

pub(crate) type TestResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

pub(crate) fn initialize_port(port: &mut dyn ProviderPort) -> TestResult<ProviderInitializeResult> {
    Ok(port.initialize(ProviderInitializeRequest::conduit_default())?)
}

pub(crate) fn fixture_root(value: Value) -> TestResult<TempDir> {
    let root = TempDir::new()?;
    for provider in [ProviderId::Claude, ProviderId::Copilot, ProviderId::Codex] {
        write_initialize_capture(root.path(), provider, "default")?;
    }
    let dir = root.path().join("codex/session-list");
    create_dir_all(&dir)?;
    write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&value)?,
    )?;
    Ok(root)
}

pub(crate) fn write_initialize_capture(
    root: &std::path::Path,
    provider: ProviderId,
    capture: &str,
) -> TestResult<()> {
    let dir = root
        .join(provider.as_str())
        .join("initialize")
        .join(capture);
    create_dir_all(&dir)?;
    write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&test_initialize_result())?,
    )?;
    Ok(())
}

fn test_initialize_result() -> ProviderInitializeResult {
    ProviderInitializeResult {
        request: ProviderInitializeRequest::conduit_default(),
        response: ProviderInitializeResponse {
            protocol_version: ProtocolVersion::V1,
            agent_capabilities: AgentCapabilities::default(),
            agent_info: Some(Implementation::new("fixture-agent", "0.1.0")),
            auth_methods: Vec::new(),
        },
    }
}

pub(crate) struct SessionLoadCapture<'a> {
    pub(crate) capture: &'a str,
    pub(crate) session_id: &'a str,
    pub(crate) manifest_session_id: Option<&'a str>,
    pub(crate) response: Value,
    pub(crate) updates: Vec<acp_core::TranscriptUpdateSnapshot>,
}

pub(crate) fn write_session_load_capture(
    root: &std::path::Path,
    capture: SessionLoadCapture<'_>,
) -> TestResult<()> {
    let dir = root.join("codex/session-load").join(capture.capture);
    create_dir_all(&dir)?;
    if let Some(manifest_session_id) = capture.manifest_session_id {
        write(
            dir.join("manifest.json"),
            serde_json::to_string(&json!({
                "operation": "session/load",
                "provider": "codex",
                "sessionId": manifest_session_id
            }))?,
        )?;
    }
    write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&json!({
            "response": capture.response,
            "loadedTranscript": {
                "identity": {
                    "provider": "codex",
                    "acpSessionId": capture.session_id
                },
                "rawUpdateCount": capture.updates.len(),
                "updates": capture.updates
            }
        }))?,
    )?;
    Ok(())
}

pub(crate) fn write_session_new_capture(
    root: &std::path::Path,
    capture: &str,
    response: Value,
) -> TestResult<()> {
    let dir = root.join("codex/session-new").join(capture);
    create_dir_all(&dir)?;
    write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&response)?,
    )?;
    Ok(())
}

pub(crate) struct SessionPromptCapture<'a> {
    pub(crate) capture: &'a str,
    pub(crate) prompt: Vec<Value>,
    pub(crate) response: Value,
    pub(crate) session_id: &'a str,
    pub(crate) updates: Vec<acp_core::TranscriptUpdateSnapshot>,
}

pub(crate) fn write_session_prompt_capture(
    root: &std::path::Path,
    capture: SessionPromptCapture<'_>,
) -> TestResult<()> {
    let dir = root
        .join("codex/session-prompt")
        .join(capture.session_id)
        .join(capture.capture);
    create_dir_all(&dir)?;
    write(
        dir.join("manifest.json"),
        serde_json::to_string(&json!({
            "operation": "session/prompt",
            "provider": "codex",
            "sessionId": capture.session_id
        }))?,
    )?;
    write(
        dir.join("provider.raw.json"),
        serde_json::to_string(&json!({
            "promptRequest": {
                "sessionId": capture.session_id,
                "prompt": capture.prompt
            },
            "promptResponse": capture.response,
            "promptUpdates": capture.updates
        }))?,
    )?;
    Ok(())
}

pub(crate) fn transcript_update(
    index: usize,
    variant: &str,
    text: &str,
) -> acp_core::TranscriptUpdateSnapshot {
    acp_core::TranscriptUpdateSnapshot {
        index,
        variant: variant.to_owned(),
        update: json!({
            "sessionUpdate": variant,
            "content": { "type": "text", "text": text }
        }),
    }
}

pub(crate) fn command(id: &str, name: &str, provider: &str, params: Value) -> ConsumerCommand {
    ConsumerCommand {
        id: id.to_owned(),
        command: name.to_owned(),
        provider: provider.to_owned(),
        params,
    }
}

pub(crate) fn value_contains_string(value: &Value, expected: &str) -> bool {
    match value {
        Value::String(value) => value.contains(expected),
        Value::Array(values) => values
            .iter()
            .any(|value| value_contains_string(value, expected)),
        Value::Object(values) => values
            .values()
            .any(|value| value_contains_string(value, expected)),
        Value::Null | Value::Bool(_) | Value::Number(_) => false,
    }
}
