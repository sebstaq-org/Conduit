//! Product home path ownership for `service-bin`.

use crate::error::{Result, ServiceError};
use directories::ProjectDirs;
use std::env;
use std::path::PathBuf;

const CONDUIT_HOME_ENV: &str = "CONDUIT_HOME";

/// Resolves the product home used by local persistent service state.
///
/// # Errors
///
/// Returns an error when no explicit home is configured and the OS app-data
/// directory cannot be resolved.
pub(crate) fn product_home() -> Result<PathBuf> {
    if let Some(home) = configured_home() {
        return Ok(home);
    }
    let Some(project_dirs) = ProjectDirs::from("dev", "Conduit", "Conduit") else {
        return Err(ServiceError::ProductHomeDirectory);
    };
    Ok(project_dirs.data_dir().to_path_buf())
}

fn configured_home() -> Option<PathBuf> {
    let value = env::var(CONDUIT_HOME_ENV).ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}
