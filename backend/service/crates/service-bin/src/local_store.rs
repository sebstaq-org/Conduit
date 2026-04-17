//! Product local-store path ownership for `service-bin`.

use crate::error::{Result, ServiceError};
use directories::ProjectDirs;
use session_store::LocalStore;
use std::path::PathBuf;

/// Opens the product SQLite local store.
///
/// # Errors
///
/// Returns an error when the OS app-data directory cannot be resolved or the
/// SQLite store cannot be opened.
pub(crate) fn open_product_store() -> Result<LocalStore> {
    open_store(None)
}

/// Opens either the product store or an explicitly configured SQLite store.
///
/// # Errors
///
/// Returns an error when the OS app-data directory cannot be resolved, the
/// configured path cannot be opened, or the SQLite store cannot be initialized.
pub(crate) fn open_store(path: Option<PathBuf>) -> Result<LocalStore> {
    Ok(LocalStore::open_path(
        path.unwrap_or(product_store_path()?),
    )?)
}

fn product_store_path() -> Result<PathBuf> {
    let Some(project_dirs) = ProjectDirs::from("dev", "Conduit", "Conduit") else {
        return Err(ServiceError::LocalStoreDataDirectory);
    };
    Ok(project_dirs.data_dir().join("local-store.sqlite3"))
}
