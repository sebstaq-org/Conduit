//! Proof-workspace preparation and path helpers.

use super::home::seed_provider_home;
use crate::error::{Result, ServiceError};
use acp_discovery::{ProcessEnvironment, ProviderId};
use std::fs::{create_dir_all, remove_dir, remove_dir_all};
use std::path::{Path, PathBuf};
use std::thread::sleep;
use std::time::Duration;

/// One isolated proof workspace for a single provider/scenario pair.
pub(crate) struct ProofWorkspace {
    artifact_root: PathBuf,
    proof_root: PathBuf,
    cwd: PathBuf,
    home_root: PathBuf,
    environment: ProcessEnvironment,
}

impl ProofWorkspace {
    /// Prepares a clean isolated proof workspace for one artifact scenario.
    ///
    /// # Errors
    ///
    /// Returns an error when the artifact or proof directories cannot be
    /// cleaned or re-created, or when provider auth/config seeding fails.
    pub(crate) fn prepare(provider: ProviderId, artifact_root: &Path) -> Result<Self> {
        let absolute_artifact_root = absolutize(artifact_root)?;
        let scenario = absolute_artifact_root
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| invalid_capture(&absolute_artifact_root))?;
        let phase_root = absolute_artifact_root
            .parent()
            .and_then(Path::parent)
            .ok_or_else(|| invalid_capture(&absolute_artifact_root))?;
        let proof_root = phase_root
            .join("_proof-workspaces")
            .join(provider.as_str())
            .join(scenario);
        let cwd = proof_root.join("cwd");
        let home_root = proof_root.join("home");
        let workspace = Self {
            artifact_root: absolute_artifact_root,
            proof_root,
            cwd,
            home_root,
            environment: ProcessEnvironment::empty(),
        };
        workspace.reset()?;
        seed_provider_home(provider, &workspace.home_root)?;
        Ok(workspace.with_environment())
    }

    /// Returns the isolated ACP session working directory for the scenario.
    #[must_use]
    pub(crate) fn cwd(&self) -> PathBuf {
        self.cwd.clone()
    }

    /// Returns the artifact root for this proof scenario.
    #[must_use]
    pub(crate) fn artifact_root(&self) -> &Path {
        &self.artifact_root
    }

    /// Returns the isolated proof-home root for the scenario.
    #[must_use]
    pub(crate) fn home_root(&self) -> &Path {
        &self.home_root
    }

    /// Returns the launcher environment overrides for this proof scenario.
    #[must_use]
    pub(crate) fn environment(&self) -> &ProcessEnvironment {
        &self.environment
    }

    /// Returns a markdown fragment describing the isolated proof workspace.
    #[must_use]
    pub(crate) fn summary_lines(&self) -> String {
        format!(
            "Proof workspace: `{}`\n\nProof cwd: `{}`\n\nProof home: `{}`\n",
            self.proof_root.display(),
            self.cwd.display(),
            self.home_root.display()
        )
    }

    fn with_environment(mut self) -> Self {
        let config_root = self.proof_root.join("xdg-config");
        let cache_root = self.proof_root.join("xdg-cache");
        let state_root = self.proof_root.join("xdg-state");
        let tmp_root = self.proof_root.join("tmp");
        self.environment = ProcessEnvironment::empty()
            .with_current_dir(&self.cwd)
            .with_var("HOME", self.home_root.display().to_string())
            .with_var("XDG_CONFIG_HOME", config_root.display().to_string())
            .with_var("XDG_CACHE_HOME", cache_root.display().to_string())
            .with_var("XDG_STATE_HOME", state_root.display().to_string())
            .with_var("TMPDIR", tmp_root.display().to_string());
        self
    }

    fn reset(&self) -> Result<()> {
        remove_path_if_present(&self.artifact_root)?;
        remove_path_if_present(&self.proof_root)?;
        create_path(&self.artifact_root)?;
        create_path(&self.cwd)?;
        create_path(&self.home_root)?;
        create_path(&self.proof_root.join("xdg-config"))?;
        create_path(&self.proof_root.join("xdg-cache"))?;
        create_path(&self.proof_root.join("xdg-state"))?;
        create_path(&self.proof_root.join("tmp"))?;
        Ok(())
    }
}

impl Drop for ProofWorkspace {
    fn drop(&mut self) {
        for _attempt in 0..30 {
            if remove_dir_all(&self.proof_root).is_ok() || !self.proof_root.exists() {
                cleanup_empty_parents(&self.proof_root);
                return;
            }
            sleep(Duration::from_millis(100));
        }
    }
}

fn cleanup_empty_parents(path: &Path) {
    let Some(provider_root) = path.parent() else {
        return;
    };
    let Some(workspaces_root) = provider_root.parent() else {
        return;
    };
    let _ = remove_dir(provider_root);
    let _ = remove_dir(workspaces_root);
}

fn absolutize(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        let current_dir = std::env::current_dir().map_err(|source| ServiceError::PreparePath {
            path: path.to_path_buf(),
            source,
        })?;
        Ok(current_dir.join(path))
    }
}

fn create_path(path: &Path) -> Result<()> {
    create_dir_all(path).map_err(|source| ServiceError::PreparePath {
        path: path.to_path_buf(),
        source,
    })
}

fn invalid_capture(path: &Path) -> ServiceError {
    ServiceError::InvalidCapture {
        message: format!("invalid artifact root {}", path.display()),
    }
}

fn remove_path_if_present(path: &Path) -> Result<()> {
    if path.exists() {
        remove_dir_all(path).map_err(|source| ServiceError::PreparePath {
            path: path.to_path_buf(),
            source,
        })?;
    }
    Ok(())
}
