//! Executable resolution helpers for official ACP launchers.

use crate::error::{DiscoveryError, Result};
use std::env;
use std::path::{Path, PathBuf};

/// Resolves a launcher executable against the current process `PATH`.
pub(crate) fn resolve_executable(program: &str) -> Result<PathBuf> {
    if program.contains('/') {
        return resolve_explicit(program);
    }

    let Some(path) = env::var_os("PATH") else {
        return Err(DiscoveryError::ExecutableNotFound {
            program: program.to_owned(),
        });
    };

    env::split_paths(&path)
        .map(|root| root.join(program))
        .find(|candidate| is_executable(candidate))
        .map(canonicalize)
        .transpose()?
        .ok_or_else(|| DiscoveryError::ExecutableNotFound {
            program: program.to_owned(),
        })
}

fn resolve_explicit(program: &str) -> Result<PathBuf> {
    let candidate = PathBuf::from(program);
    if is_executable(&candidate) {
        return canonicalize(candidate);
    }

    Err(DiscoveryError::ExecutableNotFound {
        program: program.to_owned(),
    })
}

fn canonicalize(path: PathBuf) -> Result<PathBuf> {
    std::fs::canonicalize(&path).map_err(|source| DiscoveryError::CanonicalizePath { path, source })
}

fn is_executable(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|metadata| metadata.is_file())
        .unwrap_or(false)
}
