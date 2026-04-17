//! Runtime consumer API smoke command execution.

use crate::error::Result;
use crate::local_store::open_product_store;
use serde::Serialize;
use service_runtime::{ConsumerCommand, ServiceRuntime};

/// Writes one machine-readable JSON value to stdout.
///
/// # Errors
///
/// Returns an error when the value cannot be serialized to stdout.
pub(crate) fn write_json<T: Serialize>(value: &T) -> Result<()> {
    serde_json::to_writer_pretty(std::io::stdout().lock(), value)?;
    Ok(())
}

/// Runs one non-proof runtime command and writes a consumer envelope to stdout.
///
/// # Errors
///
/// Returns an error when the response cannot be serialized to stdout.
pub(crate) fn run(command: ConsumerCommand) -> Result<()> {
    let mut runtime = ServiceRuntime::new(open_product_store()?);
    let response = runtime.dispatch(command);
    write_json(&response)
}
