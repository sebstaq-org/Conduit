//! History window assertions for ACP replay fixtures.

use serde_json::Value;

use super::support::{TestResult, response_result};

pub(crate) fn assert_history_expectations(frame: &Value, operation: &Value) -> TestResult<()> {
    if let Some(expected_variants) = operation
        .get("assert_history_item_variants")
        .and_then(Value::as_array)
    {
        let variants = expected_variants
            .iter()
            .map(|variant| variant.as_str().map(ToOwned::to_owned))
            .collect::<Option<Vec<_>>>()
            .ok_or("assert_history_item_variants contained a non-string value")?;
        assert_history_item_variants(frame, &variants)?;
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

pub(crate) fn assert_history_item_variants(frame: &Value, expected: &[String]) -> TestResult<()> {
    let actual = response_result(frame)?
        .get("items")
        .and_then(Value::as_array)
        .ok_or("history result was missing items")?
        .iter()
        .map(history_item_variant)
        .collect::<TestResult<Vec<_>>>()?;
    if actual == expected {
        return Ok(());
    }
    Err(format!("expected history item variants {expected:?}, got {actual:?}").into())
}

fn history_item_variant(item: &Value) -> TestResult<String> {
    item.get("sourceVariants")
        .and_then(Value::as_array)
        .and_then(|variants| variants.first())
        .and_then(Value::as_str)
        .or_else(|| item.get("variant").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("history item was missing variant: {item}").into())
}
