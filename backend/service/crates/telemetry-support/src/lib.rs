//! Shared telemetry initialization and log sink ownership for Conduit Rust
//! binaries.

#![forbid(unsafe_code)]

mod log_files;

pub use log_files::{
    LogFileError, LogFilePolicy, ManagedLogFile, conduit_log_base_path,
    log_base_path_for_data_root, prepare_append_path,
};
use std::env;
use std::io::{self, Write};
use std::sync::{Arc, Mutex};
use tracing_appender::non_blocking::{NonBlockingBuilder, WorkerGuard};
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::{EnvFilter, fmt};

const LOG_PROFILE_ENV: &str = "CONDUIT_LOG_PROFILE";
const TELEMETRY_IO_FAILED: &str = "telemetry_io_failed";

/// The Conduit binary installing a telemetry subscriber.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TelemetryBinary {
    /// The main product backend service.
    Backend,
    /// The repo guard CLI.
    RepoGuard,
}

impl TelemetryBinary {
    /// Returns the tracing `source` field for the binary.
    #[must_use]
    pub fn source(self) -> &'static str {
        match self {
            Self::Backend => "service-bin",
            Self::RepoGuard => "repo-guard",
        }
    }

    fn file_name(self) -> &'static str {
        match self {
            Self::Backend => "backend.log",
            Self::RepoGuard => "repo-guard.log",
        }
    }

    fn worker_thread_name(self) -> &'static str {
        match self {
            Self::Backend => "conduit-backend-log-writer",
            Self::RepoGuard => "conduit-repo-guard-log-writer",
        }
    }

    /// Returns the canonical log path for an explicit data root.
    #[must_use]
    pub fn log_path_for_data_root(self, data_root: &std::path::Path) -> std::path::PathBuf {
        log_base_path_for_data_root(data_root, self.file_name())
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LogProfile {
    Dev,
    Stage,
    Prod,
}

impl LogProfile {
    fn detect() -> Self {
        match env::var(LOG_PROFILE_ENV)
            .ok()
            .map(|raw| raw.trim().to_ascii_lowercase())
            .as_deref()
        {
            Some("dev") => Self::Dev,
            Some("stage") => Self::Stage,
            Some("prod") => Self::Prod,
            Some(_) | None if cfg!(debug_assertions) => Self::Dev,
            Some(_) | None => Self::Prod,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Dev => "dev",
            Self::Stage => "stage",
            Self::Prod => "prod",
        }
    }

    fn default_level(self) -> &'static str {
        match self {
            Self::Dev | Self::Stage => "debug",
            Self::Prod => "info",
        }
    }
}

#[derive(Debug, thiserror::Error)]
/// Errors raised while installing the Conduit telemetry subscriber.
pub enum TelemetryInitError {
    /// Canonical log path resolution or file setup failed.
    #[error(transparent)]
    LogFile(#[from] LogFileError),
    /// The tracing subscriber could not be installed.
    #[error("failed to initialize tracing subscriber: {source}")]
    SubscriberInstall {
        /// The subscriber installation failure details.
        source: Box<dyn std::error::Error + Send + Sync>,
    },
}

#[derive(Clone)]
/// Shared runtime health handle for the active telemetry sink.
pub struct TelemetryHealth {
    state: Arc<Mutex<TelemetryHealthState>>,
}

#[derive(Debug)]
struct TelemetryHealthState {
    error_code: Option<&'static str>,
    error_message: Option<String>,
}

impl Default for TelemetryHealth {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(TelemetryHealthState {
                error_code: None,
                error_message: None,
            })),
        }
    }
}

impl TelemetryHealth {
    /// Returns the current telemetry sink status.
    #[must_use]
    pub fn status(&self) -> TelemetryStatus {
        let state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        TelemetryStatus {
            error_code: state.error_code,
            error_message: state.error_message.clone(),
            ok: state.error_code.is_none(),
        }
    }

    fn record_ok(&self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        state.error_code = None;
        state.error_message = None;
    }

    fn record_io_failure(&self, error: &io::Error) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        state.error_code = Some(TELEMETRY_IO_FAILED);
        state.error_message = Some(error.to_string());
    }
}

/// A snapshot of the current telemetry sink health.
#[derive(Debug)]
pub struct TelemetryStatus {
    /// Whether the sink is healthy.
    pub ok: bool,
    /// Stable error code when the sink is unhealthy.
    pub error_code: Option<&'static str>,
    /// Human-readable failure details when the sink is unhealthy.
    pub error_message: Option<String>,
}

/// The installed telemetry runtime for one process.
pub struct InstalledTelemetry {
    _guard: WorkerGuard,
    health: TelemetryHealth,
}

impl InstalledTelemetry {
    /// Returns a cloneable health handle for runtime health checks.
    #[must_use]
    pub fn health(&self) -> TelemetryHealth {
        self.health.clone()
    }
}

/// Installs the Conduit JSON tracing subscriber for one process.
///
/// # Errors
///
/// Returns an error when the canonical log path cannot be prepared or the
/// tracing subscriber cannot be installed.
pub fn init(binary: TelemetryBinary) -> Result<InstalledTelemetry, TelemetryInitError> {
    let profile = LogProfile::detect();
    let default_level = profile.default_level();
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_error| EnvFilter::new(default_level));
    let policy = LogFilePolicy::standard();
    let base_path = conduit_log_base_path(binary.file_name())?;
    let health = TelemetryHealth::default();
    let writer = TelemetryFileWriter::new(
        ManagedLogFile::open(base_path.clone(), policy)?,
        health.clone(),
    );
    let (non_blocking, guard) = NonBlockingBuilder::default()
        .lossy(false)
        .thread_name(binary.worker_thread_name())
        .finish(writer);
    fmt()
        .json()
        .with_env_filter(filter)
        .with_span_events(FmtSpan::CLOSE)
        .with_current_span(true)
        .with_target(true)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_ansi(false)
        .with_writer(non_blocking)
        .try_init()
        .map_err(|source| TelemetryInitError::SubscriberInstall { source })?;
    tracing::info!(
        event_name = "telemetry.initialized",
        source = binary.source(),
        default_level,
        log_profile = profile.as_str(),
        max_file_bytes = policy.max_file_bytes,
        path = %base_path.display(),
        retention_days = policy.retention_days
    );
    Ok(InstalledTelemetry {
        _guard: guard,
        health,
    })
}

struct TelemetryFileWriter {
    health: TelemetryHealth,
    inner: ManagedLogFile,
}

impl TelemetryFileWriter {
    fn new(inner: ManagedLogFile, health: TelemetryHealth) -> Self {
        Self { health, inner }
    }
}

impl Write for TelemetryFileWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        match self.inner.write(buf) {
            Ok(written) => {
                self.health.record_ok();
                Ok(written)
            }
            Err(error) => {
                self.health.record_io_failure(&error);
                Err(error)
            }
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        match self.inner.flush() {
            Ok(()) => {
                self.health.record_ok();
                Ok(())
            }
            Err(error) => {
                self.health.record_io_failure(&error);
                Err(error)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{TelemetryBinary, TelemetryHealth};
    use std::io;
    use std::path::Path;

    #[test]
    fn resolves_binary_specific_log_paths() {
        let backend_path = TelemetryBinary::Backend.log_path_for_data_root(Path::new("/tmp/data"));
        let repo_guard_path =
            TelemetryBinary::RepoGuard.log_path_for_data_root(Path::new("/tmp/data"));
        assert_eq!(backend_path, Path::new("/tmp/data/logs/backend.log"));
        assert_eq!(repo_guard_path, Path::new("/tmp/data/logs/repo-guard.log"));
    }

    #[test]
    fn telemetry_health_reports_the_last_io_failure() {
        let health = TelemetryHealth::default();
        health.record_io_failure(&io::Error::other("disk full"));
        let status = health.status();
        assert!(!status.ok);
        assert_eq!(status.error_code, Some("telemetry_io_failed"));
        assert_eq!(status.error_message.as_deref(), Some("disk full"));
    }
}
