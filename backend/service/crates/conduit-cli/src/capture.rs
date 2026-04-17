//! Provider capture implementation.

use crate::cli::{CaptureOperation, CaptureRequest};
use crate::error::{CliError, Result};
use acp_discovery::ProviderId;
use app_api::AppService;
use serde::Serialize;
use serde_json::{Value, json};
use session_projection::TranscriptItemStatus;
use std::fs::{File, create_dir, create_dir_all, read_to_string};
use std::io::Write;
use std::path::{Path, PathBuf};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

const DEFAULT_CAPTURE_ROOT: &str = "/srv/devops/repos/conduit-artifacts/manual/captures";

/// Result of one completed provider capture.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CaptureResult {
    /// Output directory containing capture artifacts.
    pub(crate) output: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureManifest {
    capture_kind: &'static str,
    contract_boundary: &'static str,
    cwd: String,
    manual_capture: bool,
    operation: &'static str,
    output_path: String,
    provider: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
    timestamp: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LedgerEvent {
    cwd: String,
    event_name: &'static str,
    ok: bool,
    operation: &'static str,
    output_path: String,
    provider: &'static str,
    timestamp: String,
}

/// Runs one provider capture.
///
/// # Errors
///
/// Returns an error when Codex cannot be reached, the capture output cannot be
/// written, or the provider response is not a valid v1 provider capture.
pub(crate) fn run_capture(request: CaptureRequest) -> Result<CaptureResult> {
    let CaptureRequest {
        operation,
        cwd,
        output,
    } = request;
    let timestamp = timestamp()?;
    let output = output_path(output, &operation, &timestamp);
    create_output_dir(&output)?;
    create_capture_cwd(&operation, &cwd)?;
    let mut ledger = Ledger::new(&cwd, &output, operation_name(&operation));
    ledger.push("capture.start", true)?;
    write_manifest(&operation, &cwd, &output, &timestamp)?;

    ledger.push("provider.connect.start", true)?;
    let mut service = match AppService::connect_provider(ProviderId::Codex) {
        Ok(service) => {
            ledger.push("provider.connect.finish", true)?;
            service
        }
        Err(error) => {
            ledger.push("provider.connect.finish", false)?;
            ledger.write(&output)?;
            return Err(error.into());
        }
    };

    let raw = match capture_provider(&mut service, &operation, &cwd, &mut ledger) {
        Ok(raw) => raw,
        Err(error) => {
            service.disconnect_provider();
            ledger.push("provider.disconnect.finish", true)?;
            ledger.push("capture.finish", false)?;
            ledger.write(&output)?;
            return Err(error);
        }
    };

    service.disconnect_provider();
    ledger.push("provider.disconnect.finish", true)?;
    if let Err(error) = validate_capture(&operation, &raw) {
        ledger.push("capture.finish", false)?;
        ledger.write(&output)?;
        return Err(error);
    }
    let normalized = normalize_capture(&operation, &raw)?;
    write_json(&output.join("provider.raw.json"), &raw)?;
    write_json(&output.join("provider.normalized.json"), &normalized)?;
    ledger.push("capture.finish", true)?;
    ledger.write(&output)?;
    Ok(CaptureResult { output })
}

fn capture_provider(
    service: &mut AppService,
    operation: &CaptureOperation,
    cwd: &Path,
    ledger: &mut Ledger,
) -> Result<Value> {
    match operation {
        CaptureOperation::New => capture_session_new(service, cwd, ledger),
        CaptureOperation::List => capture_session_list(service, cwd, ledger),
        CaptureOperation::Load { session_id } => {
            capture_session_load(service, session_id, cwd, ledger)
        }
        CaptureOperation::Prompt {
            session_id,
            prompt_path,
        } => capture_session_prompt(service, session_id.as_deref(), prompt_path, cwd, ledger),
    }
}

fn capture_session_new(service: &mut AppService, cwd: &Path, ledger: &mut Ledger) -> Result<Value> {
    ledger.push("provider.session_new.start", true)?;
    match service.new_session(cwd.to_path_buf()) {
        Ok(response) => {
            ledger.push("provider.session_new.finish", true)?;
            Ok(serde_json::to_value(response)?)
        }
        Err(error) => {
            ledger.push("provider.session_new.finish", false)?;
            Err(error.into())
        }
    }
}

fn capture_session_list(
    service: &mut AppService,
    cwd: &Path,
    ledger: &mut Ledger,
) -> Result<Value> {
    ledger.push("provider.session_list.start", true)?;
    match service.list_sessions_filtered(Some(cwd.to_path_buf()), None) {
        Ok(response) => {
            ledger.push("provider.session_list.finish", true)?;
            Ok(serde_json::to_value(response)?)
        }
        Err(error) => {
            ledger.push("provider.session_list.finish", false)?;
            Err(error.into())
        }
    }
}

fn capture_session_load(
    service: &mut AppService,
    session_id: &str,
    cwd: &Path,
    ledger: &mut Ledger,
) -> Result<Value> {
    ledger.push("provider.session_load.start", true)?;
    match service.load_session(session_id.to_owned(), cwd.to_path_buf()) {
        Ok(response) => {
            ledger.push("provider.session_load.finish", true)?;
            let snapshot = service.get_provider_snapshot();
            let loaded_transcript = loaded_transcript_value(&snapshot, session_id)?;
            Ok(json!({
                "response": response,
                "loadedTranscript": loaded_transcript,
            }))
        }
        Err(error) => {
            ledger.push("provider.session_load.finish", false)?;
            Err(error.into())
        }
    }
}

fn capture_session_prompt(
    service: &mut AppService,
    session_id: Option<&str>,
    prompt_path: &Path,
    cwd: &Path,
    ledger: &mut Ledger,
) -> Result<Value> {
    let prompt = read_prompt_blocks(prompt_path)?;
    let (session_new, resolved_session_id) = match session_id {
        Some(session_id) => (Value::Null, session_id.to_owned()),
        None => {
            let response = capture_session_new(service, cwd, ledger)?;
            let session_id = extract_session_id(&response)?;
            (response, session_id)
        }
    };

    let mut prompt_updates = Vec::new();
    ledger.push("provider.session_prompt.start", true)?;
    match service.prompt_content_blocks(&resolved_session_id, prompt.clone(), &mut |update| {
        prompt_updates.push(update);
    }) {
        Ok(response) => {
            ledger.push("provider.session_prompt.finish", true)?;
            Ok(json!({
                "sessionNew": session_new,
                "promptRequest": {
                    "sessionId": resolved_session_id,
                    "prompt": prompt,
                },
                "promptResponse": response,
                "promptUpdates": prompt_updates,
            }))
        }
        Err(error) => {
            ledger.push("provider.session_prompt.finish", false)?;
            Err(error.into())
        }
    }
}

fn read_prompt_blocks(path: &Path) -> Result<Vec<Value>> {
    let body =
        read_to_string(path).map_err(|source| CliError::io(Some(path.to_path_buf()), source))?;
    let value: Value = serde_json::from_str(&body)?;
    match value {
        Value::Array(blocks) => Ok(blocks),
        _ => Err(CliError::invalid_command(
            "session/prompt prompt file must contain a ContentBlock array",
        )),
    }
}

fn extract_session_id(value: &Value) -> Result<String> {
    value
        .get("sessionId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/new response must contain a sessionId string",
            )
        })
}

fn loaded_transcript_value(
    snapshot: &acp_core::ProviderSnapshot,
    session_id: &str,
) -> Result<Value> {
    let transcript = snapshot
        .loaded_transcripts
        .iter()
        .find(|transcript| transcript.identity.acp_session_id == session_id)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/load response did not produce a loaded transcript snapshot",
            )
        })?;
    Ok(json!({
        "identity": {
            "provider": transcript.identity.provider.as_str(),
            "acpSessionId": transcript.identity.acp_session_id,
        },
        "rawUpdateCount": transcript.raw_update_count,
        "updates": transcript.updates,
    }))
}

fn output_path(
    configured: Option<PathBuf>,
    operation: &CaptureOperation,
    timestamp: &str,
) -> PathBuf {
    configured.unwrap_or_else(|| {
        PathBuf::from(DEFAULT_CAPTURE_ROOT)
            .join("codex")
            .join(operation_slug(operation))
            .join(timestamp.replace(':', ""))
    })
}

fn create_output_dir(output: &Path) -> Result<()> {
    if let Some(parent) = output.parent() {
        create_dir_all(parent)
            .map_err(|source| CliError::io(Some(parent.to_path_buf()), source))?;
    }
    create_dir(output).map_err(|source| CliError::io(Some(output.to_path_buf()), source))
}

fn create_capture_cwd(operation: &CaptureOperation, cwd: &Path) -> Result<()> {
    if matches!(
        operation,
        CaptureOperation::New | CaptureOperation::Prompt { .. }
    ) {
        create_dir_all(cwd).map_err(|source| CliError::io(Some(cwd.to_path_buf()), source))?;
    }
    Ok(())
}

fn write_manifest(
    operation: &CaptureOperation,
    cwd: &Path,
    output: &Path,
    timestamp: &str,
) -> Result<()> {
    let manifest = CaptureManifest {
        capture_kind: "provider",
        contract_boundary: "provider-acp",
        cwd: cwd.display().to_string(),
        manual_capture: true,
        operation: operation_name(operation),
        output_path: output.display().to_string(),
        provider: "codex",
        session_id: session_id(operation),
        timestamp: timestamp.to_owned(),
    };
    write_json(&output.join("manifest.json"), &manifest)
}

fn validate_capture(operation: &CaptureOperation, value: &Value) -> Result<()> {
    match operation {
        CaptureOperation::New => validate_session_new(value),
        CaptureOperation::List => validate_session_list(value),
        CaptureOperation::Load { .. } => validate_session_load(value),
        CaptureOperation::Prompt { .. } => validate_session_prompt(value),
    }
}

fn validate_session_new(value: &Value) -> Result<()> {
    if value.get("sessionId").and_then(Value::as_str).is_some() {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/new response must contain a sessionId string",
    ))
}

fn validate_session_list(value: &Value) -> Result<()> {
    if value.get("sessions").and_then(Value::as_array).is_some() {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/list response must contain a sessions array",
    ))
}

fn validate_session_load(value: &Value) -> Result<()> {
    if value.get("response").is_none() {
        return Err(CliError::invalid_capture(
            "provider session/load capture must contain a response field",
        ));
    }
    if value
        .pointer("/loadedTranscript/rawUpdateCount")
        .and_then(Value::as_u64)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/load capture must contain loadedTranscript.rawUpdateCount number",
        ));
    }
    if value
        .pointer("/loadedTranscript/updates")
        .and_then(Value::as_array)
        .is_some()
    {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/load capture must contain loadedTranscript.updates array",
    ))
}

fn validate_session_prompt(value: &Value) -> Result<()> {
    if value
        .pointer("/promptRequest/sessionId")
        .and_then(Value::as_str)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/prompt capture must contain promptRequest.sessionId string",
        ));
    }
    if value
        .pointer("/promptRequest/prompt")
        .and_then(Value::as_array)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/prompt capture must contain promptRequest.prompt array",
        ));
    }
    if value
        .pointer("/promptResponse/stopReason")
        .and_then(Value::as_str)
        .is_none()
    {
        return Err(CliError::invalid_capture(
            "provider session/prompt capture must contain promptResponse.stopReason string",
        ));
    }
    if value
        .get("promptUpdates")
        .and_then(Value::as_array)
        .is_some()
    {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/prompt capture must contain promptUpdates array",
    ))
}

fn normalize_capture(operation: &CaptureOperation, value: &Value) -> Result<Value> {
    match operation {
        CaptureOperation::Prompt { .. } => normalize_session_prompt(value),
        CaptureOperation::New | CaptureOperation::List | CaptureOperation::Load { .. } => {
            Ok(value.clone())
        }
    }
}

fn normalize_session_prompt(value: &Value) -> Result<Value> {
    let session_id = value
        .pointer("/promptRequest/sessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptRequest.sessionId string",
            )
        })?;
    let prompt = value
        .pointer("/promptRequest/prompt")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptRequest.prompt array",
            )
        })?
        .to_vec();
    let stop_reason = value
        .pointer("/promptResponse/stopReason")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptResponse.stopReason string",
            )
        })?;
    let updates: Vec<acp_core::TranscriptUpdateSnapshot> =
        serde_json::from_value(value.get("promptUpdates").cloned().ok_or_else(|| {
            CliError::invalid_capture(
                "provider session/prompt capture must contain promptUpdates array",
            )
        })?)?;
    let items = session_projection::prompt_turn_items(
        "capture-turn",
        &prompt,
        &updates,
        TranscriptItemStatus::Complete,
        Some(stop_reason),
    );
    Ok(json!({
        "operation": "session/prompt",
        "sessionId": session_id,
        "prompt": prompt,
        "stopReason": stop_reason,
        "items": items,
    }))
}

fn operation_name(operation: &CaptureOperation) -> &'static str {
    match operation {
        CaptureOperation::New => "session/new",
        CaptureOperation::List => "session/list",
        CaptureOperation::Load { .. } => "session/load",
        CaptureOperation::Prompt { .. } => "session/prompt",
    }
}

fn operation_slug(operation: &CaptureOperation) -> &'static str {
    match operation {
        CaptureOperation::New => "session-new",
        CaptureOperation::List => "session-list",
        CaptureOperation::Load { .. } => "session-load",
        CaptureOperation::Prompt { .. } => "session-prompt",
    }
}

fn session_id(operation: &CaptureOperation) -> Option<String> {
    match operation {
        CaptureOperation::New | CaptureOperation::List => None,
        CaptureOperation::Load { session_id } => Some(session_id.clone()),
        CaptureOperation::Prompt { session_id, .. } => session_id.clone(),
    }
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let file =
        File::create(path).map_err(|source| CliError::io(Some(path.to_path_buf()), source))?;
    serde_json::to_writer_pretty(file, value)?;
    Ok(())
}

fn timestamp() -> Result<String> {
    Ok(OffsetDateTime::now_utc().format(&Rfc3339)?)
}

struct Ledger {
    cwd: String,
    events: Vec<LedgerEvent>,
    operation: &'static str,
    output_path: String,
}

impl Ledger {
    fn new(cwd: &Path, output: &Path, operation: &'static str) -> Self {
        Self {
            cwd: cwd.display().to_string(),
            events: Vec::new(),
            operation,
            output_path: output.display().to_string(),
        }
    }

    fn push(&mut self, event_name: &'static str, ok: bool) -> Result<()> {
        self.events.push(LedgerEvent {
            cwd: self.cwd.clone(),
            event_name,
            ok,
            operation: self.operation,
            output_path: self.output_path.clone(),
            provider: "codex",
            timestamp: timestamp()?,
        });
        Ok(())
    }

    fn write(&self, output: &Path) -> Result<()> {
        let path = output.join("ledger.jsonl");
        let mut file =
            File::create(&path).map_err(|source| CliError::io(Some(path.clone()), source))?;
        for event in &self.events {
            serde_json::to_writer(&mut file, event)?;
            file.write_all(b"\n")
                .map_err(|source| CliError::io(Some(path.clone()), source))?;
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "capture_tests.rs"]
mod tests;
