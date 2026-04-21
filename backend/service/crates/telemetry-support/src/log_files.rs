//! Shared Conduit log-file path and rotation policy.

use directories::ProjectDirs;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use time::{Date, Duration, Month, OffsetDateTime};

/// The shared rotation and retention policy for Conduit log files.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LogFilePolicy {
    /// Maximum size for one rotated file slot.
    pub max_file_bytes: u64,
    /// Number of daily files to retain.
    pub retention_days: i64,
    /// Number of per-day rotation slots before writes fail.
    pub rotation_slot_limit: u16,
}

impl LogFilePolicy {
    /// The standard Conduit logging policy.
    #[must_use]
    pub const fn standard() -> Self {
        Self {
            max_file_bytes: 20 * 1024 * 1024,
            retention_days: 7,
            rotation_slot_limit: 1024,
        }
    }
}

/// Errors raised while resolving or rotating log files.
#[derive(Debug, thiserror::Error)]
pub enum LogFileError {
    /// The operating system did not provide an application data directory.
    #[error("log data directory is unavailable")]
    DataDirectoryUnavailable,
    /// A filesystem operation failed.
    #[error(transparent)]
    Io(#[from] io::Error),
    /// The current day exhausted every rotation slot.
    #[error("log rotation slots exhausted for current day")]
    RotationSlotsExhausted,
}

/// Returns the canonical Conduit log base path under the current data root.
///
/// # Errors
///
/// Returns an error when the operating system does not provide an application
/// data directory.
pub fn conduit_log_base_path(file_name: &str) -> Result<PathBuf, LogFileError> {
    let project_dirs = ProjectDirs::from("dev", "Conduit", "Conduit")
        .ok_or(LogFileError::DataDirectoryUnavailable)?;
    Ok(log_base_path_for_data_root(
        project_dirs.data_dir(),
        file_name,
    ))
}

/// Returns the canonical Conduit log base path for an explicit data root.
#[must_use]
pub fn log_base_path_for_data_root(data_root: &Path, file_name: &str) -> PathBuf {
    data_root.join("logs").join(file_name)
}

/// Prepares the append path for the given timestamp.
///
/// This creates the parent directory, removes stale files, and returns the
/// active file path for the current day and rotation slot.
///
/// # Errors
///
/// Returns an error when directory creation, pruning, or path selection fails.
pub fn prepare_append_path(
    base_path: &Path,
    policy: LogFilePolicy,
    timestamp: OffsetDateTime,
) -> Result<PathBuf, LogFileError> {
    let parent_dir = parent_directory(base_path);
    fs::create_dir_all(&parent_dir)?;
    prune_stale_files(base_path, policy, timestamp.date())?;
    find_append_path(base_path, policy, timestamp.date())
}

/// A file writer that keeps the active Conduit log file open and rotates it
/// according to the shared policy.
pub struct ManagedLogFile {
    base_path: PathBuf,
    policy: LogFilePolicy,
    current_date: Date,
    current_len: u64,
    file: File,
}

impl ManagedLogFile {
    /// Opens the active Conduit log file for append.
    ///
    /// # Errors
    ///
    /// Returns an error when the active file cannot be resolved or opened.
    pub fn open(base_path: PathBuf, policy: LogFilePolicy) -> Result<Self, LogFileError> {
        let now = OffsetDateTime::now_utc();
        let current_path = prepare_append_path(&base_path, policy, now)?;
        let current_len = current_file_len(&current_path)?;
        let file = open_append_file(&current_path)?;
        Ok(Self {
            base_path,
            policy,
            current_date: now.date(),
            current_len,
            file,
        })
    }
}

impl Write for ManagedLogFile {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.rotate_if_needed(buf.len())?;
        let written = self.file.write(buf)?;
        self.current_len = self.current_len.saturating_add(written as u64);
        Ok(written)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.file.flush()
    }
}

impl ManagedLogFile {
    fn rotate_if_needed(&mut self, incoming_len: usize) -> io::Result<()> {
        let now = OffsetDateTime::now_utc();
        let today = now.date();
        let exceeds_size = self.current_len > 0
            && self.current_len.saturating_add(incoming_len as u64) > self.policy.max_file_bytes;
        if today == self.current_date && !exceeds_size {
            return Ok(());
        }
        let next_path =
            prepare_append_path(&self.base_path, self.policy, now).map_err(log_file_to_io_error)?;
        let next_len = current_file_len(&next_path)?;
        let file = open_append_file(&next_path)?;
        self.current_date = today;
        self.current_len = next_len;
        self.file = file;
        Ok(())
    }
}

fn log_file_to_io_error(error: LogFileError) -> io::Error {
    match error {
        LogFileError::Io(error) => error,
        other => io::Error::other(other.to_string()),
    }
}

fn current_file_len(path: &Path) -> io::Result<u64> {
    match fs::metadata(path) {
        Ok(metadata) => Ok(metadata.len()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(0),
        Err(error) => Err(error),
    }
}

fn open_append_file(path: &Path) -> io::Result<File> {
    OpenOptions::new().create(true).append(true).open(path)
}

fn prune_stale_files(
    base_path: &Path,
    policy: LogFilePolicy,
    today: Date,
) -> Result<(), LogFileError> {
    let retention_floor = today - Duration::days(policy.retention_days - 1);
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

fn find_append_path(
    base_path: &Path,
    policy: LogFilePolicy,
    today: Date,
) -> Result<PathBuf, LogFileError> {
    let template = FileNameTemplate::from_base_path(base_path);
    let parent = parent_directory(base_path);
    for rotation_slot in 0..policy.rotation_slot_limit {
        let candidate = template.daily_path(parent.as_path(), today, rotation_slot);
        match fs::metadata(candidate.as_path()) {
            Ok(metadata) if metadata.len() >= policy.max_file_bytes => continue,
            Ok(_) => return Ok(candidate),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(candidate),
            Err(error) => return Err(LogFileError::Io(error)),
        }
    }
    Err(LogFileError::RotationSlotsExhausted)
}

fn parent_directory(base_path: &Path) -> PathBuf {
    match base_path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
    }
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
            .unwrap_or_else(|| "backend.log".to_owned());
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
    use super::{LogFilePolicy, ManagedLogFile, log_base_path_for_data_root, prepare_append_path};
    use std::error::Error;
    use std::fs;
    use std::io::Write;
    use std::path::Path;
    use tempfile::TempDir;
    use time::{Date, Month, OffsetDateTime, Time};

    type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

    fn sample_timestamp(day: u8) -> TestResult<OffsetDateTime> {
        let date = Date::from_calendar_date(2026, Month::April, day)?;
        Ok(OffsetDateTime::new_utc(date, Time::MIDNIGHT))
    }

    #[test]
    fn builds_canonical_log_paths_from_data_root() -> TestResult<()> {
        let path = log_base_path_for_data_root(Path::new("/tmp/conduit"), "backend.log");
        let expected = Path::new("/tmp/conduit/logs/backend.log");
        if path != expected {
            return Err(format!("expected {:?}, got {:?}", expected, path).into());
        }
        Ok(())
    }

    #[test]
    fn rotates_daily_files_by_size_and_prunes_stale_files() -> TestResult<()> {
        let tempdir = TempDir::new()?;
        let base_path = tempdir.path().join("frontend.log");
        let policy = LogFilePolicy {
            max_file_bytes: 4,
            retention_days: 2,
            rotation_slot_limit: 8,
        };
        let previous_day = prepare_append_path(&base_path, policy, sample_timestamp(14)?)?;
        fs::write(&previous_day, b"old")?;
        let old_day = prepare_append_path(&base_path, policy, sample_timestamp(13)?)?;
        fs::write(&old_day, b"old")?;
        let today = prepare_append_path(&base_path, policy, sample_timestamp(15)?)?;
        fs::write(&today, b"abcd")?;

        let rotated = prepare_append_path(&base_path, policy, sample_timestamp(15)?)?;
        let expected = tempdir.path().join("frontend-2026-04-15.1.log");
        if rotated != expected {
            return Err(format!("expected {:?}, got {:?}", expected, rotated).into());
        }
        if !previous_day.exists() {
            return Err("previous-day log should still exist".into());
        }
        if old_day.exists() {
            return Err("stale log should have been pruned".into());
        }
        Ok(())
    }

    #[test]
    fn managed_log_file_rotates_to_next_slot_when_current_slot_is_full() -> TestResult<()> {
        let tempdir = TempDir::new()?;
        let base_path = tempdir.path().join("backend.log");
        let policy = LogFilePolicy {
            max_file_bytes: 4,
            retention_days: 7,
            rotation_slot_limit: 8,
        };
        let mut writer = ManagedLogFile::open(base_path.clone(), policy)?;
        writer.write_all(b"abcd")?;
        writer.write_all(b"ef")?;
        let today = OffsetDateTime::now_utc().date();
        let primary = base_path.with_file_name(format!(
            "backend-{:04}-{:02}-{:02}.log",
            today.year(),
            u8::from(today.month()),
            today.day()
        ));
        let rotated = base_path.with_file_name(format!(
            "backend-{:04}-{:02}-{:02}.1.log",
            today.year(),
            u8::from(today.month()),
            today.day()
        ));
        let primary_bytes = fs::read(primary)?;
        if primary_bytes.as_slice() != b"abcd" {
            return Err(format!("unexpected primary bytes: {:?}", primary_bytes).into());
        }
        let rotated_bytes = fs::read(rotated)?;
        if rotated_bytes.as_slice() != b"ef" {
            return Err(format!("unexpected rotated bytes: {:?}", rotated_bytes).into());
        }
        Ok(())
    }
}
