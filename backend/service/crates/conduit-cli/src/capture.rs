//! Provider capture implementation.

use crate::cli::{CaptureOperation, CaptureRequest};
use crate::error::{CliError, Result};
use acp_discovery::ProviderId;
use app_api::AppService;
use serde::Serialize;
use serde_json::{Value, json};
use std::fs::{File, create_dir, create_dir_all};
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
    write_json(&output.join("provider.raw.json"), &raw)?;
    write_json(&output.join("provider.normalized.json"), &raw)?;
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
        CaptureOperation::SessionList => capture_session_list(service, cwd, ledger),
        CaptureOperation::SessionLoad { session_id } => {
            capture_session_load(service, session_id, cwd, ledger)
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
        CaptureOperation::SessionList => validate_session_list(value),
        CaptureOperation::SessionLoad { .. } => validate_session_load(value),
    }
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

fn operation_name(operation: &CaptureOperation) -> &'static str {
    match operation {
        CaptureOperation::SessionList => "session/list",
        CaptureOperation::SessionLoad { .. } => "session/load",
    }
}

fn operation_slug(operation: &CaptureOperation) -> &'static str {
    match operation {
        CaptureOperation::SessionList => "session-list",
        CaptureOperation::SessionLoad { .. } => "session-load",
    }
}

fn session_id(operation: &CaptureOperation) -> Option<String> {
    match operation {
        CaptureOperation::SessionList => None,
        CaptureOperation::SessionLoad { session_id } => Some(session_id.clone()),
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
mod tests {
    use super::{create_output_dir, validate_session_list, validate_session_load, write_json};
    use serde_json::json;
    use std::fs::{create_dir, read_to_string};
    use tempfile::TempDir;

    #[test]
    fn accepts_session_list_with_sessions_array() {
        assert!(validate_session_list(&json!({ "sessions": [] })).is_ok());
    }

    #[test]
    fn rejects_session_list_without_sessions_array() {
        let error = validate_session_list(&json!({ "nextCursor": null }))
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(error.contains("sessions array"));
    }

    #[test]
    fn accepts_session_load_with_response_and_loaded_transcript_updates() {
        assert!(
            validate_session_load(&json!({
                "response": {},
                "loadedTranscript": {
                    "rawUpdateCount": 0,
                    "updates": []
                }
            }))
            .is_ok()
        );
    }

    #[test]
    fn rejects_session_load_without_response() {
        let error = validate_session_load(&json!({
            "loadedTranscript": {
                "rawUpdateCount": 0,
                "updates": []
            }
        }))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("response field"));
    }

    #[test]
    fn rejects_session_load_without_loaded_transcript_update_count() {
        let error = validate_session_load(&json!({
            "response": {},
            "loadedTranscript": { "updates": [] }
        }))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("rawUpdateCount number"));
    }

    #[test]
    fn rejects_session_load_without_loaded_transcript_updates() {
        let error = validate_session_load(&json!({
            "response": {},
            "loadedTranscript": { "rawUpdateCount": 0 }
        }))
        .err()
        .map(|error| error.to_string())
        .unwrap_or_default();
        assert!(error.contains("loadedTranscript.updates array"));
    }

    #[test]
    fn writer_refuses_existing_output_directory() -> Result<(), Box<dyn std::error::Error>> {
        let tempdir = TempDir::new()?;
        let output = tempdir.path().join("capture");
        create_dir(&output)?;
        let error = create_output_dir(&output)
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        if !error.contains("capture") {
            return Err("expected existing output directory error".into());
        }
        Ok(())
    }

    #[test]
    fn writes_pretty_json_file() -> Result<(), Box<dyn std::error::Error>> {
        let tempdir = TempDir::new()?;
        let path = tempdir.path().join("provider.raw.json");
        write_json(&path, &json!({ "sessions": [] }))?;
        let body = read_to_string(path)?;
        if !body.contains("\"sessions\"") {
            return Err("expected sessions field in JSON body".into());
        }
        Ok(())
    }
}
