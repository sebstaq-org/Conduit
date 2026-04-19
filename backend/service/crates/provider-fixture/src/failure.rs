//! Provider failure fixture helpers.

use crate::{invalid_fixture, read_json};
use serde_json::Value;
use service_runtime::Result;
use std::path::Path;

#[derive(Debug, Clone)]
pub(crate) struct ProviderFailureFixture {
    pub(crate) message: String,
}

pub(crate) fn read_provider_failure_fixture(
    path: &Path,
    operation: &'static str,
) -> Result<ProviderFailureFixture> {
    let value = read_json(path)?;
    if !value.is_object() {
        return Err(invalid_fixture(path, "must be a JSON object"));
    }
    if value.get("operation").and_then(Value::as_str) != Some(operation) {
        return Err(invalid_fixture(path, "must identify the failing operation"));
    }
    let message = value
        .get("message")
        .and_then(Value::as_str)
        .filter(|message| !message.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_fixture(path, "must contain a non-empty message"))?;
    Ok(ProviderFailureFixture { message })
}
