//! Frontend client-log ingestion and JSONL persistence.

use directories::ProjectDirs;
use serde_json::{Map, Value};
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use time::{Date, Duration, Month, OffsetDateTime};
use tokio::sync::Mutex;

const CLIENT_LOG_PATH_ENV: &str = "CONDUIT_FRONTEND_LOG_PATH";
const LOG_PROFILE_ENV: &str = "CONDUIT_LOG_PROFILE";
const DEFAULT_FILE_NAME: &str = "frontend.log";
const MAX_BATCH_RECORDS: usize = 256;
const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
const RETENTION_DAYS: i64 = 7;
const ROTATION_SLOT_LIMIT: u16 = 1024;

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
            max_file_bytes = MAX_FILE_BYTES,
            retention_days = RETENTION_DAYS
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
    let parent_dir = parent_directory(&base_path);
    fs::create_dir_all(&parent_dir)?;
    prune_stale_files(&base_path, now.date())?;
    let output_path = find_append_path(&base_path, now.date())?;
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
    let project_dirs = ProjectDirs::from("dev", "Conduit", "Conduit")?;
    Some(project_dirs.data_dir().join("logs").join(DEFAULT_FILE_NAME))
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

fn prune_stale_files(base_path: &Path, today: Date) -> Result<(), ClientLogError> {
    let retention_floor = today - Duration::days(RETENTION_DAYS - 1);
    let template = FileNameTemplate::from_base_path(base_path);
    let parent = parent_directory(base_path);
    for entry in fs::read_dir(parent)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if !metadata.is_file() {
            continue;
        }
        let Some(file_name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        let Some(file_date) = template.parse_date_from_file_name(&file_name) else {
            continue;
        };
        if file_date < retention_floor {
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn find_append_path(base_path: &Path, today: Date) -> Result<PathBuf, ClientLogError> {
    let template = FileNameTemplate::from_base_path(base_path);
    let parent = parent_directory(base_path);
    for rotation_slot in 0..ROTATION_SLOT_LIMIT {
        let candidate = template.daily_path(parent.as_path(), today, rotation_slot);
        match fs::metadata(candidate.as_path()) {
            Ok(metadata) if metadata.len() >= MAX_FILE_BYTES => continue,
            Ok(_) => return Ok(candidate),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(candidate),
            Err(error) => return Err(ClientLogError::Io(error)),
        }
    }
    Err(ClientLogError::RotationSlotsExhausted)
}

fn parent_directory(base_path: &Path) -> PathBuf {
    match base_path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
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

fn format_date(date: Date) -> String {
    format!(
        "{:04}-{:02}-{:02}",
        date.year(),
        u8::from(date.month()),
        date.day()
    )
}

fn parse_date_token(token: &str) -> Option<Date> {
    let mut parts = token.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month = parts.next()?.parse::<u8>().ok()?;
    let day = parts.next()?.parse::<u8>().ok()?;
    if parts.next().is_some() {
        return None;
    }
    let month = Month::try_from(month).ok()?;
    Date::from_calendar_date(year, month, day).ok()
}

#[derive(Debug)]
struct FileNameTemplate {
    stem: String,
    extension: String,
}

impl FileNameTemplate {
    fn from_base_path(base_path: &Path) -> Self {
        let raw_name = base_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| DEFAULT_FILE_NAME.to_owned());
        let extension = base_path
            .extension()
            .map(|ext| format!(".{}", ext.to_string_lossy()))
            .unwrap_or_default();
        let stem = if extension.is_empty() {
            raw_name
        } else {
            raw_name
                .strip_suffix(extension.as_str())
                .map(str::to_owned)
                .unwrap_or(raw_name)
        };
        Self { stem, extension }
    }

    fn daily_path(&self, parent: &Path, day: Date, rotation_slot: u16) -> PathBuf {
        let mut file_name = format!("{}-{}", self.stem, format_date(day));
        if rotation_slot > 0 {
            file_name.push('.');
            file_name.push_str(&rotation_slot.to_string());
        }
        file_name.push_str(self.extension.as_str());
        parent.join(file_name)
    }

    fn parse_date_from_file_name(&self, file_name: &str) -> Option<Date> {
        let prefix = format!("{}-", self.stem);
        if !file_name.starts_with(prefix.as_str()) {
            return None;
        }
        let without_extension = if self.extension.is_empty() {
            file_name
        } else {
            file_name.strip_suffix(self.extension.as_str())?
        };
        let date_and_slot = without_extension.strip_prefix(prefix.as_str())?;
        let date_token = date_and_slot.split('.').next()?;
        parse_date_token(date_token)
    }
}

#[cfg(test)]
mod tests {
    use super::{Date, FileNameTemplate, Month, parse_date_token};
    use std::error::Error;
    use std::path::Path;

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    #[test]
    fn parses_date_tokens() -> TestResult<()> {
        let date = parse_date_token("2026-04-16");
        if date != Some(Date::from_calendar_date(2026, Month::April, 16)?) {
            return Err("failed to parse date token".into());
        }
        let invalid = parse_date_token("2026-04-16-01");
        if invalid.is_some() {
            return Err("accepted invalid date token".into());
        }
        Ok(())
    }

    #[test]
    fn builds_daily_paths_with_rotation_suffix() -> TestResult<()> {
        let template = FileNameTemplate::from_base_path(Path::new("frontend.log"));
        let day = Date::from_calendar_date(2026, Month::April, 16)?;
        let primary = template.daily_path(Path::new("/tmp"), day, 0);
        let rotated = template.daily_path(Path::new("/tmp"), day, 2);
        if primary != Path::new("/tmp/frontend-2026-04-16.log") {
            return Err("unexpected primary log path".into());
        }
        if rotated != Path::new("/tmp/frontend-2026-04-16.2.log") {
            return Err("unexpected rotated log path".into());
        }
        Ok(())
    }
}
