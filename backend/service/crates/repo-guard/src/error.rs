//! Error types for the repo guard CLI.

use std::error::Error as StdError;
use std::fmt::{Display, Formatter};
use std::io;
use std::path::PathBuf;
use std::process::ExitStatus;

/// The concrete result type used by the repo guard CLI.
pub(crate) type Result<T> = std::result::Result<T, Error>;

/// The error type used by the repo guard CLI.
#[derive(Debug)]
pub(crate) enum Error {
    /// The command-line arguments were invalid.
    InvalidArgs(String),
    /// A policy check produced one or more failures.
    Policy(Vec<String>),
    /// Reading a file or directory failed.
    Io {
        /// The path that failed, when available.
        path: Option<PathBuf>,
        /// The underlying I/O error.
        source: io::Error,
    },
    /// Parsing JSON failed.
    Json {
        /// The file path that failed.
        path: PathBuf,
        /// The underlying JSON error.
        source: serde_json::Error,
    },
    /// Parsing TOML failed.
    Toml {
        /// The file path that failed.
        path: PathBuf,
        /// The underlying TOML error.
        source: toml::de::Error,
    },
    /// Starting a child process failed.
    CommandIo {
        /// The rendered command.
        command: String,
        /// The underlying process error.
        source: io::Error,
    },
    /// A child process exited unsuccessfully.
    CommandFailed {
        /// The rendered command.
        command: String,
        /// The exit status.
        status: ExitStatus,
        /// Captured standard error, when available.
        stderr: String,
    },
    /// Telemetry initialization failed.
    Telemetry {
        /// The underlying telemetry error.
        source: telemetry_support::TelemetryInitError,
    },
}

impl Error {
    /// Creates an invalid-arguments error.
    pub(crate) fn invalid_args(message: &str) -> Self {
        Self::InvalidArgs(message.to_owned())
    }

    /// Creates a policy-failure error.
    pub(crate) fn policy(failures: Vec<String>) -> Self {
        Self::Policy(failures)
    }

    /// Creates an I/O error tied to a file path.
    pub(crate) fn io(path: Option<PathBuf>, source: io::Error) -> Self {
        Self::Io { path, source }
    }

    /// Creates a command-start error.
    pub(crate) fn command_io(command: String, source: io::Error) -> Self {
        Self::CommandIo { command, source }
    }

    /// Creates a failed-command error.
    pub(crate) fn command_failed(command: String, status: ExitStatus, stderr: String) -> Self {
        Self::CommandFailed {
            command,
            status,
            stderr,
        }
    }

    /// Creates a telemetry initialization error.
    pub(crate) fn telemetry(source: telemetry_support::TelemetryInitError) -> Self {
        Self::Telemetry { source }
    }
}

impl Display for Error {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidArgs(message) => write!(formatter, "{message}"),
            Self::Policy(failures) => {
                if failures.is_empty() {
                    return write!(formatter, "policy check failed");
                }

                write!(formatter, "{}", failures.join("\n"))
            }
            Self::Io { path, source } => match path {
                Some(path) => write!(formatter, "{}: {source}", path.display()),
                None => write!(formatter, "{source}"),
            },
            Self::Json { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::Toml { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::CommandIo { command, source } => write!(formatter, "{command}: {source}"),
            Self::CommandFailed {
                command,
                status,
                stderr,
            } => {
                if stderr.trim().is_empty() {
                    write!(formatter, "{command} exited with status {status}")
                } else {
                    write!(
                        formatter,
                        "{command} exited with status {status}: {}",
                        stderr.trim()
                    )
                }
            }
            Self::Telemetry { source } => write!(formatter, "{source}"),
        }
    }
}

impl StdError for Error {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            Self::Json { source, .. } => Some(source),
            Self::Toml { source, .. } => Some(source),
            Self::CommandIo { source, .. } => Some(source),
            Self::Telemetry { source } => Some(source),
            Self::InvalidArgs(_) | Self::Policy(_) | Self::CommandFailed { .. } => None,
        }
    }
}
