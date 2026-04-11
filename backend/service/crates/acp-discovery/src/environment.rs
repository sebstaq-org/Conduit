//! Process-environment overrides for official ACP launcher execution.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// One set of environment overrides for provider launcher processes.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProcessEnvironment {
    /// The optional working directory for the spawned launcher process.
    pub current_dir: Option<PathBuf>,
    /// Exact environment variables to override for the spawned process.
    pub env: BTreeMap<String, String>,
}

impl ProcessEnvironment {
    /// Returns an empty process environment with no overrides.
    #[must_use]
    pub fn empty() -> Self {
        Self::default()
    }

    /// Sets the current directory override.
    #[must_use]
    pub fn with_current_dir(mut self, path: impl Into<PathBuf>) -> Self {
        self.current_dir = Some(path.into());
        self
    }

    /// Adds one environment variable override.
    #[must_use]
    pub fn with_var(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }

    /// Applies the configured overrides to a process command.
    pub fn apply_to_command(&self, command: &mut std::process::Command) {
        if let Some(current_dir) = &self.current_dir {
            command.current_dir(current_dir);
        }
        for (key, value) in &self.env {
            command.env(key, value);
        }
    }

    /// Returns the current-directory override, if any.
    #[must_use]
    pub fn current_dir(&self) -> Option<&Path> {
        self.current_dir.as_deref()
    }
}
