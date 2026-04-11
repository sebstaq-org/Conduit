//! Runtime consumer API smoke command execution.

use crate::error::Result;
use service_runtime::{ConsumerCommand, ServiceRuntime};
use session_store::LocalStore;

/// Runs one non-proof runtime command and writes a consumer envelope to stdout.
///
/// # Errors
///
/// Returns an error when the response cannot be serialized to stdout.
pub(crate) fn run(command: ConsumerCommand) -> Result<()> {
    let mut runtime = ServiceRuntime::new(LocalStore::open_default()?);
    let response = runtime.dispatch(command);
    serde_json::to_writer_pretty(std::io::stdout().lock(), &response)?;
    Ok(())
}
