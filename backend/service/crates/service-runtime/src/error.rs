//! Error types for the Conduit consumer runtime.

use std::path::PathBuf;
use thiserror::Error;

/// Result type for consumer runtime operations.
pub type Result<T> = std::result::Result<T, RuntimeError>;

/// Errors produced by `service-runtime`.
#[derive(Debug, Error)]
pub enum RuntimeError {
    /// The request named an unsupported provider.
    #[error("unknown provider {provider}: {message}")]
    UnknownProvider {
        /// Provider string supplied by the consumer.
        provider: String,
        /// Parse failure detail.
        message: &'static str,
    },
    /// The request named an unsupported command.
    #[error("unsupported command {0}")]
    UnsupportedCommand(String),
    /// The request was missing a required parameter.
    #[error("{command} is missing parameter {parameter}")]
    MissingParameter {
        /// Command being handled.
        command: &'static str,
        /// Required parameter name.
        parameter: &'static str,
    },
    /// The request parameter was not a string.
    #[error("{command} parameter {parameter} must be a string")]
    InvalidStringParameter {
        /// Command being handled.
        command: &'static str,
        /// Required parameter name.
        parameter: &'static str,
    },
    /// The request parameter was not a valid path string.
    #[error("{command} parameter {parameter} must be a path")]
    InvalidPathParameter {
        /// Command being handled.
        command: &'static str,
        /// Required parameter name.
        parameter: &'static str,
    },
    /// The provider operation failed.
    #[error("{0}")]
    Provider(String),
}

impl RuntimeError {
    pub(crate) fn code(&self) -> &'static str {
        match self {
            Self::UnknownProvider { .. } => "unknown_provider",
            Self::UnsupportedCommand(_) => "unsupported_command",
            Self::MissingParameter { .. }
            | Self::InvalidStringParameter { .. }
            | Self::InvalidPathParameter { .. } => "invalid_params",
            Self::Provider(_) => "provider_error",
        }
    }
}

impl From<serde_json::Error> for RuntimeError {
    fn from(error: serde_json::Error) -> Self {
        Self::Provider(error.to_string())
    }
}

pub(crate) fn string_param(
    command: &'static str,
    params: &serde_json::Value,
    parameter: &'static str,
) -> Result<String> {
    let Some(value) = params.get(parameter) else {
        return Err(RuntimeError::MissingParameter { command, parameter });
    };
    value
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or(RuntimeError::InvalidStringParameter { command, parameter })
}

pub(crate) fn path_param(
    command: &'static str,
    params: &serde_json::Value,
    parameter: &'static str,
) -> Result<PathBuf> {
    Ok(PathBuf::from(string_param(command, params, parameter)?))
}
