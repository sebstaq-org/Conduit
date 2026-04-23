//! Frontend client-log ingestion and JSONL persistence.

use serde_json::{Map, Value};
use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use telemetry_support::{LogFilePolicy, conduit_log_base_path, prepare_append_path};
use time::OffsetDateTime;
use tokio::sync::Mutex;

const CLIENT_LOG_PATH_ENV: &str = "CONDUIT_FRONTEND_LOG_PATH";
const LOG_PROFILE_ENV: &str = "CONDUIT_LOG_PROFILE";
const DEFAULT_FILE_NAME: &str = "frontend.log";
const MAX_BATCH_RECORDS: usize = 256;

#[derive(Clone)]
pub(super) struct ClientLogSink {
    mode: SinkMode,
}

#[derive(Clone)]
enum SinkMode {
    Disabled,
    File(FileSink),
}

#[derive(Clone)]
struct FileSink {
    base_path: PathBuf,
    write_lock: Arc<Mutex<()>>,
}

#[derive(Debug, serde::Deserialize)]
pub(super) struct ClientLogBatch {
    #[serde(default)]
    records: Vec<Value>,
}

impl ClientLogBatch {
    pub(super) fn record_count(&self) -> usize {
        self.records.len()
    }
}

#[derive(Debug, thiserror::Error)]
pub(super) enum ClientLogError {
    #[error("client-log payload has too many records")]
    TooManyRecords,
    #[error("client-log payload is invalid: {0}")]
    InvalidPayload(&'static str),
    #[error("client-log rotation slots exhausted for current day")]
    RotationSlotsExhausted,
    #[error("client-log serialization failed: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("client-log filesystem operation failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("client-log append task failed: {0}")]
    Join(#[from] tokio::task::JoinError),
}

impl ClientLogError {
    pub(super) fn is_payload_error(&self) -> bool {
        matches!(self, Self::TooManyRecords | Self::InvalidPayload(_))
    }
}

impl ClientLogSink {
    #[allow(
        clippy::cognitive_complexity,
        reason = "Sink detection intentionally handles profile/path fallbacks with explicit observability logs."
    )]
    pub(super) fn detect() -> Self {
        if !client_log_profile_enabled() {
            tracing::info!(
                event_name = "client_log_sink.disabled",
                source = "service-bin",
                reason = "profile_disabled"
            );
            return Self {
                mode: SinkMode::Disabled,
            };
        }
        let Some(base_path) = resolve_base_path() else {
            tracing::warn!(
                event_name = "client_log_sink.disabled",
                source = "service-bin",
                reason = "path_unavailable"
            );
            return Self {
                mode: SinkMode::Disabled,
            };
        };
        tracing::info!(
            event_name = "client_log_sink.enabled",
            source = "service-bin",
            path = %base_path.display(),
            max_file_bytes = LogFilePolicy::standard().max_file_bytes,
            retention_days = LogFilePolicy::standard().retention_days
        );
        Self {
            mode: SinkMode::File(FileSink {
                base_path,
                write_lock: Arc::new(Mutex::new(())),
            }),
        }
    }

    /// Appends a validated client-log batch to JSONL storage.
    ///
    /// # Errors
    ///
    /// Returns an error when payload validation fails, serialization fails, or
    /// file operations cannot complete.
    pub(super) async fn append(&self, batch: ClientLogBatch) -> Result<(), ClientLogError> {
        match &self.mode {
            SinkMode::Disabled => Ok(()),
            SinkMode::File(file_sink) => file_sink.append(batch).await,
        }
    }
}

impl FileSink {
    async fn append(&self, batch: ClientLogBatch) -> Result<(), ClientLogError> {
        if batch.records.is_empty() {
            return Ok(());
        }
        if batch.records.len() > MAX_BATCH_RECORDS {
            return Err(ClientLogError::TooManyRecords);
        }
        validate_records(&batch.records)?;
        let _guard = self.write_lock.lock().await;
        let base_path = self.base_path.clone();
        tokio::task::spawn_blocking(move || append_records(base_path, batch.records)).await??;
        Ok(())
    }
}

fn append_records(base_path: PathBuf, records: Vec<Value>) -> Result<(), ClientLogError> {
    let now = OffsetDateTime::now_utc();
    let timestamp = format_timestamp(now);
    let output_path = prepare_append_path(&base_path, LogFilePolicy::standard(), now)
        .map_err(client_log_error_from_log_file_error)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(output_path)?;
    for record in records {
        let mut object = match record {
            Value::Object(map) => map,
            _ => {
                return Err(ClientLogError::InvalidPayload(
                    "record must be a JSON object",
                ));
            }
        };
        object.insert("ingested_at".to_owned(), Value::String(timestamp.clone()));
        let line = serde_json::to_string(&object)?;
        writeln!(file, "{line}")?;
    }
    file.flush()?;
    Ok(())
}

fn validate_records(records: &[Value]) -> Result<(), ClientLogError> {
    for record in records {
        let object = match record.as_object() {
            Some(object) => object,
            None => {
                return Err(ClientLogError::InvalidPayload(
                    "record must be a JSON object",
                ));
            }
        };
        let level = read_string_field(object, "level")?;
        if !matches!(level, "debug" | "info" | "warn" | "error") {
            return Err(ClientLogError::InvalidPayload(
                "record level must be debug, info, warn, or error",
            ));
        }
        let _event_name = read_string_field(object, "event_name")?;
        let _source = read_string_field(object, "source")?;
        let _timestamp = read_string_field(object, "timestamp")?;
    }
    Ok(())
}

fn read_string_field<'obj>(
    object: &'obj Map<String, Value>,
    field: &'static str,
) -> Result<&'obj str, ClientLogError> {
    match object.get(field).and_then(Value::as_str) {
        Some(value) if !value.is_empty() => Ok(value),
        _ => Err(ClientLogError::InvalidPayload(
            "record is missing required string fields",
        )),
    }
}

fn resolve_base_path() -> Option<PathBuf> {
    if let Some(configured_path) = env::var(CLIENT_LOG_PATH_ENV)
        .ok()
        .map(|raw| raw.trim().to_owned())
    {
        if configured_path.is_empty() {
            return None;
        }
        return Some(PathBuf::from(configured_path));
    }
    conduit_log_base_path(DEFAULT_FILE_NAME).ok()
}

fn client_log_profile_enabled() -> bool {
    match env::var(LOG_PROFILE_ENV)
        .ok()
        .map(|raw| raw.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("dev") | Some("stage") => true,
        Some("prod") => false,
        Some(_) | None if cfg!(debug_assertions) => true,
        Some(_) | None => false,
    }
}

fn format_timestamp(timestamp: OffsetDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        timestamp.year(),
        u8::from(timestamp.month()),
        timestamp.day(),
        timestamp.hour(),
        timestamp.minute(),
        timestamp.second(),
        timestamp.millisecond()
    )
}

fn client_log_error_from_log_file_error(error: telemetry_support::LogFileError) -> ClientLogError {
    match error {
        telemetry_support::LogFileError::Io(error) => ClientLogError::Io(error),
        telemetry_support::LogFileError::RotationSlotsExhausted => {
            ClientLogError::RotationSlotsExhausted
        }
        telemetry_support::LogFileError::DataDirectoryUnavailable => {
            ClientLogError::InvalidPayload("client log data directory is unavailable")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::format_timestamp;
    use std::error::Error;
    use time::{Date, Month, OffsetDateTime, Time};

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    #[test]
    fn formats_utc_timestamps() -> TestResult<()> {
        let date = Date::from_calendar_date(2026, Month::April, 16)?;
        let timestamp = OffsetDateTime::new_utc(date, Time::MIDNIGHT);
        if format_timestamp(timestamp) != "2026-04-16T00:00:00.000Z" {
            return Err("unexpected timestamp format".into());
        }
        Ok(())
    }
}
