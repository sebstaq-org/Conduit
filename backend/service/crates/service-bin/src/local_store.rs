//! Product local-store path ownership for `service-bin`.

use crate::error::Result;
use crate::home::product_home;
use session_store::LocalStore;
use std::path::PathBuf;

/// Opens the product SQLite local store.
///
/// # Errors
///
/// Returns an error when the OS app-data directory cannot be resolved or the
/// SQLite store cannot be opened.
pub(crate) fn open_product_store() -> Result<LocalStore> {
    Ok(LocalStore::open_path(product_store_path()?)?)
}

fn product_store_path() -> Result<PathBuf> {
    Ok(product_home()?.join("local-store.sqlite3"))
}
