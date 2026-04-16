//! Runtime consumer API smoke command execution.

use crate::error::Result;
use crate::local_store::open_product_store;
use service_runtime::contracts::export_contract_bundle;
use service_runtime::{ConsumerCommand, ServiceRuntime};
use std::fs;
use std::path::PathBuf;

/// Runs one non-proof runtime command and writes a consumer envelope to stdout.
///
/// # Errors
///
/// Returns an error when the response cannot be serialized to stdout.
pub(crate) fn run(command: ConsumerCommand) -> Result<()> {
    let mut runtime = ServiceRuntime::new(open_product_store()?);
    let response = runtime.dispatch(command);
    serde_json::to_writer_pretty(std::io::stdout().lock(), &response)?;
    Ok(())
}

/// Exports the backend-owned contract bundle to disk.
///
/// # Errors
///
/// Returns an error when the output directory cannot be created or the schema
/// bundle cannot be serialized.
pub(crate) fn export_contracts(out: PathBuf) -> Result<()> {
    if let Some(parent) = out.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    let file = fs::File::create(out)?;
    serde_json::to_writer_pretty(file, &export_contract_bundle())?;
    Ok(())
}
