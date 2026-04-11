//! Golden-oracle assertions for curated ACP replay fixtures.
//!
//! `expected-events.jsonl` is compared with the actual `events/subscribe`
//! backlog. `expected-snapshot.json` is compared with the last response
//! snapshot emitted before `events/subscribe`.

use serde_json::{Value, json};
use std::error::Error;
use std::fs::read_to_string;
use std::path::Path;

pub(crate) type OracleResult<T> = std::result::Result<T, Box<dyn Error>>;

pub(crate) fn assert_expected_oracles(
    fixture: &Path,
    scenario: &Value,
    actual_backlog: &[Value],
    actual_snapshot: &Value,
) -> OracleResult<()> {
    assert_expected_events(fixture, scenario, actual_backlog)?;
    assert_expected_snapshot(fixture, scenario, actual_snapshot)
}

fn assert_expected_events(
    fixture: &Path,
    scenario: &Value,
    actual_backlog: &[Value],
) -> OracleResult<()> {
    let path = expected_path(fixture, "expected-events.jsonl")?;
    let expected = read_jsonl(&path)?
        .into_iter()
        .map(|event| normalize_event_oracle(event, scenario))
        .collect::<OracleResult<Vec<_>>>()?;
    let actual = actual_backlog
        .iter()
        .cloned()
        .map(|event| normalize_event_oracle(event, scenario))
        .collect::<OracleResult<Vec<_>>>()?;
    assert_json_eq(
        scenario,
        &path,
        &Value::Array(expected),
        &Value::Array(actual),
    )
}

fn assert_expected_snapshot(
    fixture: &Path,
    scenario: &Value,
    actual_snapshot: &Value,
) -> OracleResult<()> {
    let path = expected_path(fixture, "expected-snapshot.json")?;
    let expected = normalize_snapshot_oracle(read_json(&path)?, scenario)?;
    let actual = normalize_snapshot_oracle(actual_snapshot.clone(), scenario)?;
    assert_json_eq(scenario, &path, &expected, &actual)
}

pub(crate) fn normalize_event_oracle(value: Value, _scenario: &Value) -> OracleResult<Value> {
    let event = value.get("event").unwrap_or(&value);
    Ok(json!({
        "kind": event.get("kind").cloned().unwrap_or(Value::Null),
        "provider": event.get("provider").cloned().unwrap_or(Value::Null),
        "session_id": event.get("session_id").cloned().unwrap_or(Value::Null),
        "payload": event.get("payload").cloned().unwrap_or_else(|| json!({})),
    }))
}

pub(crate) fn normalize_snapshot_oracle(value: Value, scenario: &Value) -> OracleResult<Value> {
    let mut normalized = value;
    if dynamic_field_declared(scenario, &["cwd"]) {
        normalize_keyed_string_values(&mut normalized, "cwd", "/__dynamic_cwd__");
    }
    if dynamic_field_declared(scenario, &["provider version", "provider_version"]) {
        normalize_keyed_string_values(&mut normalized, "version", "/__dynamic_provider_version__");
    }
    if dynamic_field_declared(
        scenario,
        &[
            "initialize elapsed diagnostics",
            "initialize_elapsed_ms",
            "transport_diagnostics",
        ],
    ) {
        normalize_keyed_number_values(&mut normalized, "elapsed_ms", 0);
        normalize_keyed_array_values(
            &mut normalized,
            "transport_diagnostics",
            vec![Value::String(
                "/__dynamic_transport_diagnostics__".to_owned(),
            )],
        );
        normalize_keyed_array_values(
            &mut normalized,
            "stdout_lines",
            vec![Value::String("/__dynamic_initialize_stdout__".to_owned())],
        );
    }
    if dynamic_field_declared(
        scenario,
        &[
            "launcher_executable",
            "launcher paths",
            "launcher resolved path",
            "launcher_resolved_path",
            "cwd/path/launcher resolved paths",
        ],
    ) {
        normalize_path_like_strings(&mut normalized);
    }
    Ok(normalized)
}

fn normalize_keyed_number_values(value: &mut Value, key: &str, replacement: i64) {
    match value {
        Value::Object(map) => {
            for (entry_key, entry_value) in map {
                if entry_key == key && entry_value.is_number() {
                    *entry_value = Value::Number(replacement.into());
                } else {
                    normalize_keyed_number_values(entry_value, key, replacement);
                }
            }
        }
        Value::Array(values) => {
            for entry in values {
                normalize_keyed_number_values(entry, key, replacement);
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
}

fn normalize_keyed_array_values(value: &mut Value, key: &str, replacement: Vec<Value>) {
    match value {
        Value::Object(map) => {
            for (entry_key, entry_value) in map {
                if entry_key == key && entry_value.is_array() {
                    *entry_value = Value::Array(replacement.clone());
                } else {
                    normalize_keyed_array_values(entry_value, key, replacement.clone());
                }
            }
        }
        Value::Array(values) => {
            for entry in values {
                normalize_keyed_array_values(entry, key, replacement.clone());
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
}

fn normalize_keyed_string_values(value: &mut Value, key: &str, replacement: &str) {
    match value {
        Value::Object(map) => {
            for (entry_key, entry_value) in map {
                if entry_key == key && entry_value.is_string() {
                    *entry_value = Value::String(replacement.to_owned());
                } else {
                    normalize_keyed_string_values(entry_value, key, replacement);
                }
            }
        }
        Value::Array(values) => {
            for entry in values {
                normalize_keyed_string_values(entry, key, replacement);
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
}

fn normalize_path_like_strings(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for entry_value in map.values_mut() {
                normalize_path_like_strings(entry_value);
            }
        }
        Value::Array(values) => {
            for entry in values {
                normalize_path_like_strings(entry);
            }
        }
        Value::String(text) if looks_like_local_path(text) => {
            *text = "/__dynamic_path__".to_owned();
        }
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {}
    }
}

fn looks_like_local_path(text: &str) -> bool {
    text.starts_with("/srv/")
        || text.starts_with("/home/")
        || text.starts_with("/Users/")
        || text.starts_with("/tmp/")
}

fn dynamic_field_declared(scenario: &Value, allowed_names: &[&str]) -> bool {
    declared_dynamic_fields(scenario).iter().any(|field| {
        let field = field.to_ascii_lowercase();
        allowed_names
            .iter()
            .any(|allowed_name| field == *allowed_name || field.contains(*allowed_name))
    })
}

fn declared_dynamic_fields(scenario: &Value) -> Vec<String> {
    let mut fields = Vec::new();
    push_string_array(scenario.get("ignored_fields"), &mut fields);
    if let Some(observation) = scenario.get("observation") {
        push_string_array(observation.get("dynamic_ignored_fields"), &mut fields);
        push_string_array(observation.get("scrubbed_fields"), &mut fields);
    }
    fields
}

fn push_string_array(value: Option<&Value>, fields: &mut Vec<String>) {
    if let Some(entries) = value.and_then(Value::as_array) {
        fields.extend(
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned),
        );
    }
}

fn expected_path(fixture: &Path, file_name: &str) -> OracleResult<std::path::PathBuf> {
    let parent = fixture
        .parent()
        .ok_or_else(|| format!("fixture path had no parent: {}", fixture.display()))?;
    Ok(parent.join(file_name))
}

fn read_json(path: &Path) -> OracleResult<Value> {
    Ok(serde_json::from_str(&read_to_string(path)?)?)
}

fn read_jsonl(path: &Path) -> OracleResult<Vec<Value>> {
    read_to_string(path)?
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| Ok(serde_json::from_str(line)?))
        .collect()
}

fn assert_json_eq(
    scenario: &Value,
    path: &Path,
    expected: &Value,
    actual: &Value,
) -> OracleResult<()> {
    if expected == actual {
        return Ok(());
    }
    let provider = scenario
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("<unknown-provider>");
    let scenario_name = scenario
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("<unknown-scenario>");
    Err(format!(
        "oracle mismatch for provider={provider} scenario={scenario_name} file={}\nnormalized expected:\n{}\nnormalized actual:\n{}",
        path.display(),
        serde_json::to_string_pretty(expected)?,
        serde_json::to_string_pretty(actual)?
    )
    .into())
}
