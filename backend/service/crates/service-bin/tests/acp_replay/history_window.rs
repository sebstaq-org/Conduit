//! History window assertions for ACP replay fixtures.

use serde_json::Value;

use super::support::{TestResult, response_result};

pub(crate) fn assert_history_expectations(frame: &Value, operation: &Value) -> TestResult<()> {
    if let Some(expected_sequence) = operation
        .get("assert_history_item_sequence")
        .and_then(Value::as_array)
    {
        let sequence = expected_sequence
            .iter()
            .map(|item| item.as_str().map(ToOwned::to_owned))
            .collect::<Option<Vec<_>>>()
            .ok_or("assert_history_item_sequence contained a non-string value")?;
        assert_history_item_sequence(frame, &sequence)?;
    }
    if let Some(expected_cursor) = operation.get("assert_history_next_cursor") {
        let actual_cursor = response_result(frame)?
            .get("nextCursor")
            .ok_or("history result was missing nextCursor")?;
        if actual_cursor != expected_cursor {
            return Err(format!(
                "expected history nextCursor {expected_cursor}, got {actual_cursor}"
            )
            .into());
        }
    }
    Ok(())
}

pub(crate) fn assert_history_item_sequence(frame: &Value, expected: &[String]) -> TestResult<()> {
    let actual = response_result(frame)?
        .get("items")
        .and_then(Value::as_array)
        .ok_or("history result was missing items")?
        .iter()
        .map(history_item_identity)
        .collect::<TestResult<Vec<_>>>()?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected history item sequence {expected:?}, got {actual:?}").into())
}

fn history_item_identity(item: &Value) -> TestResult<String> {
    match item.get("kind").and_then(Value::as_str) {
        Some("message") => item
            .get("role")
            .and_then(Value::as_str)
            .map(|role| format!("message:{role}"))
            .ok_or_else(|| format!("message item was missing role: {item}").into()),
        Some("event") => item
            .get("variant")
            .and_then(Value::as_str)
            .map(|variant| format!("event:{variant}"))
            .ok_or_else(|| format!("event item was missing variant: {item}").into()),
        _ => Err(format!("history item had unsupported kind: {item}").into()),
    }
}
