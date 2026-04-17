//! Provider capture implementation.

use crate::cli::CaptureRequest;
use crate::error::{CliError, Result};
use acp_discovery::ProviderId;
use app_api::AppService;
use serde::Serialize;
use serde_json::Value;
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
/// written, or the provider response is not a valid v1 `session/list` capture.
pub(crate) fn run_capture(request: CaptureRequest) -> Result<CaptureResult> {
    let timestamp = timestamp()?;
    let output = output_path(request.output, &timestamp);
    create_output_dir(&output)?;
    let mut ledger = Ledger::new(&request.cwd, &output);
    ledger.push("capture.start", true)?;
    write_manifest(&request.cwd, &output, &timestamp)?;

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

    ledger.push("provider.session_list.start", true)?;
    let raw = match service.list_sessions_filtered(Some(request.cwd.clone()), None) {
        Ok(response) => {
            ledger.push("provider.session_list.finish", true)?;
            serde_json::to_value(response)?
        }
        Err(error) => {
            ledger.push("provider.session_list.finish", false)?;
            service.disconnect_provider();
            ledger.push("provider.disconnect.finish", true)?;
            ledger.write(&output)?;
            return Err(error.into());
        }
    };

    service.disconnect_provider();
    ledger.push("provider.disconnect.finish", true)?;
    if let Err(error) = validate_session_list(&raw) {
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

fn output_path(configured: Option<PathBuf>, timestamp: &str) -> PathBuf {
    configured.unwrap_or_else(|| {
        PathBuf::from(DEFAULT_CAPTURE_ROOT)
            .join("codex")
            .join("session-list")
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

fn write_manifest(cwd: &Path, output: &Path, timestamp: &str) -> Result<()> {
    let manifest = CaptureManifest {
        capture_kind: "provider",
        contract_boundary: "provider-acp",
        cwd: cwd.display().to_string(),
        manual_capture: true,
        operation: "session/list",
        output_path: output.display().to_string(),
        provider: "codex",
        timestamp: timestamp.to_owned(),
    };
    write_json(&output.join("manifest.json"), &manifest)
}

fn validate_session_list(value: &Value) -> Result<()> {
    if value.get("sessions").and_then(Value::as_array).is_some() {
        return Ok(());
    }
    Err(CliError::invalid_capture(
        "provider session/list response must contain a sessions array",
    ))
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
    output_path: String,
}

impl Ledger {
    fn new(cwd: &Path, output: &Path) -> Self {
        Self {
            cwd: cwd.display().to_string(),
            events: Vec::new(),
            output_path: output.display().to_string(),
        }
    }

    fn push(&mut self, event_name: &'static str, ok: bool) -> Result<()> {
        self.events.push(LedgerEvent {
            cwd: self.cwd.clone(),
            event_name,
            ok,
            operation: "session/list",
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
    use super::{create_output_dir, validate_session_list, write_json};
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
