//! Common helpers for fixture validation.

use serde_json::Value;
use std::collections::BTreeSet;
use std::error::Error;
use std::fs::{create_dir_all, read_dir, read_to_string, write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
pub(crate) type ValidationResult<T> = std::result::Result<T, String>;

pub(crate) const PROVIDERS: [&str; 3] = ["claude", "copilot", "codex"];
pub(crate) const REPLAY_MANIFEST_SCHEMA: &str = "conduit.acp_replay.manifest.v1";
pub(crate) const REPLAY_SCENARIO_SCHEMA: &str = "conduit.acp_replay.scenario.v1";
pub(crate) const REQUIRED_SCENARIO_FILES: [&str; 4] = [
    "scenario.json",
    "frames.jsonl",
    "expected-events.jsonl",
    "expected-snapshot.json",
];

#[derive(Default)]
pub(crate) struct ValidationReport {
    pub(crate) replay_transport_gaps: BTreeSet<String>,
    pub(crate) protocol_coverage_gaps: BTreeSet<String>,
}

#[derive(Clone, Copy)]
pub(crate) struct ValidationContext<'a, 'p> {
    pub(crate) provider: &'a str,
    pub(crate) scenario: &'a str,
    pub(crate) path: &'p Path,
}

pub(crate) fn require_file(context: ValidationContext<'_, '_>) -> ValidationResult<()> {
    if context.path.is_file() {
        return Ok(());
    }
    Err(failure(context, "required fixture file is missing"))
}

pub(crate) fn require_present(
    context: ValidationContext<'_, '_>,
    value: &Value,
    key: &str,
) -> ValidationResult<()> {
    if value.get(key).is_some() {
        return Ok(());
    }
    Err(failure(context, format!("missing required field {key}")))
}

pub(crate) fn require_string_field(
    context: ValidationContext<'_, '_>,
    value: &Value,
    key: &str,
) -> ValidationResult<()> {
    string_field(context, value, key).map(|_| ())
}

pub(crate) fn require_string_eq(
    context: ValidationContext<'_, '_>,
    value: &Value,
    key: &str,
    expected: &str,
    label: &str,
) -> ValidationResult<()> {
    let actual = string_field(context, value, key)?;
    if actual == expected {
        return Ok(());
    }
    Err(failure(
        context,
        format!("{label} {actual} did not match expected {expected}"),
    ))
}

pub(crate) fn require_string_array(
    context: ValidationContext<'_, '_>,
    value: &Value,
    key: &str,
) -> ValidationResult<()> {
    let values = array_field(context, value, key)?;
    if values.is_empty() {
        return Err(failure(context, format!("{key} must not be empty")));
    }
    if values.iter().all(Value::is_string) {
        return Ok(());
    }
    Err(failure(context, format!("{key} must contain only strings")))
}

pub(crate) fn string_field<'a>(
    context: ValidationContext<'_, '_>,
    value: &'a Value,
    key: &str,
) -> ValidationResult<&'a str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .ok_or_else(|| failure(context, format!("missing required string field {key}")))
}

pub(crate) fn array_field<'a>(
    context: ValidationContext<'_, '_>,
    value: &'a Value,
    key: &str,
) -> ValidationResult<&'a Vec<Value>> {
    value
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| failure(context, format!("missing required array field {key}")))
}

pub(crate) fn read_json(context: ValidationContext<'_, '_>) -> ValidationResult<Value> {
    let contents = read_to_string(context.path)
        .map_err(|error| failure(context, format!("could not read JSON: {error}")))?;
    serde_json::from_str(&contents)
        .map_err(|error| failure(context, format!("invalid JSON: {error}")))
}

pub(crate) fn read_jsonl(context: ValidationContext<'_, '_>) -> ValidationResult<Vec<Value>> {
    let contents = read_to_string(context.path)
        .map_err(|error| failure(context, format!("could not read JSONL: {error}")))?;
    let mut values = Vec::new();
    for (index, line) in contents
        .lines()
        .filter(|line| !line.trim().is_empty())
        .enumerate()
    {
        let value = serde_json::from_str::<Value>(line).map_err(|error| {
            failure(
                context,
                format!("invalid JSONL line {}: {error}", index + 1),
            )
        })?;
        values.push(value);
    }
    if values.is_empty() {
        return Err(failure(context, "JSONL fixture must not be empty"));
    }
    Ok(values)
}

pub(crate) fn require_capture_metadata(
    context: ValidationContext<'_, '_>,
    value: &Value,
) -> ValidationResult<()> {
    let capture_source = string_field(context, value, "capture_source")?;
    if !capture_source.starts_with("capture://") {
        return Err(failure(
            context,
            "capture_source must be a repo-neutral capture:// id",
        ));
    }
    require_string_field(context, value, "redaction_status")?;
    Ok(())
}

pub(crate) fn require_dynamic_field_metadata(
    context: ValidationContext<'_, '_>,
    scenario: &Value,
) -> ValidationResult<()> {
    let has_ignored_fields = scenario
        .get("ignored_fields")
        .and_then(Value::as_array)
        .is_some_and(|values| !values.is_empty());
    let observation = scenario.get("observation");
    let has_dynamic_fields = observation
        .and_then(|value| value.get("dynamic_ignored_fields"))
        .and_then(Value::as_array)
        .is_some_and(|values| !values.is_empty());
    let has_scrubbed_fields = observation
        .and_then(|value| value.get("scrubbed_fields"))
        .and_then(Value::as_array)
        .is_some_and(|values| !values.is_empty());
    if has_ignored_fields || has_dynamic_fields || has_scrubbed_fields {
        return Ok(());
    }
    Err(failure(
        context,
        "scenario must declare ignored/dynamic/scrubbed fields",
    ))
}

pub(crate) fn require_matching_field(
    context: ValidationContext<'_, '_>,
    left: &Value,
    right: &Value,
    key: &str,
) -> ValidationResult<()> {
    let left_value = string_field(context, left, key)?;
    let right_value = string_field(context, right, key)?;
    if left_value == right_value {
        return Ok(());
    }
    Err(failure(
        context,
        format!("{key} mismatch between manifest and scenario"),
    ))
}

pub(crate) fn scenario_path_from_manifest(
    context: ValidationContext<'_, '_>,
    replay_root: &Path,
    name: &str,
    path_text: &str,
) -> ValidationResult<PathBuf> {
    let relative = Path::new(path_text);
    if relative.components().any(forbidden_relative_component) {
        return Err(failure(
            context,
            format!("scenario path must stay under replay root: {path_text}"),
        ));
    }
    if relative.file_name().and_then(|value| value.to_str()) != Some("scenario.json") {
        return Err(failure(
            context,
            "scenario path must point at scenario.json",
        ));
    }
    if relative
        .parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        != Some(name)
    {
        return Err(failure(
            context,
            format!("manifest scenario name {name} did not match path {path_text}"),
        ));
    }
    Ok(replay_root.join(relative))
}

pub(crate) fn sorted_files(
    root: &Path,
    provider: &str,
    scenario: &str,
) -> ValidationResult<Vec<PathBuf>> {
    let mut paths = Vec::new();
    let entries = read_dir(root).map_err(|error| {
        failure(
            ValidationContext {
                provider,
                scenario,
                path: root,
            },
            format!("could not read fixture directory: {error}"),
        )
    })?;
    for entry in entries {
        let path = entry
            .map_err(|error| {
                failure(
                    ValidationContext {
                        provider,
                        scenario,
                        path: root,
                    },
                    format!("could not read fixture directory entry: {error}"),
                )
            })?
            .path();
        if path.is_file() {
            paths.push(path);
        }
    }
    paths.sort();
    Ok(paths)
}

pub(crate) fn protocol_capture_name(path: &Path) -> &str {
    path.file_name()
        .and_then(|value| value.to_str())
        .and_then(|name| name.split('.').next())
        .unwrap_or("<protocol>")
}

pub(crate) fn envelope_id(envelope: &Value) -> Option<String> {
    let id = envelope.get("id")?;
    if let Some(value) = id.as_u64() {
        return Some(value.to_string());
    }
    id.as_str().map(ToOwned::to_owned)
}

pub(crate) fn is_raw_wire_event_frame(frame: &Value) -> bool {
    frame
        .get("event")
        .and_then(|event| event.get("kind"))
        .and_then(Value::as_str)
        == Some("raw_wire_event_captured")
}

pub(crate) fn is_locked_request_method(method_name: &str) -> bool {
    [
        "initialize",
        "session/new",
        "session/list",
        "session/load",
        "session/prompt",
    ]
    .contains(&method_name)
}

pub(crate) fn failure(
    context: ValidationContext<'_, '_>,
    message: impl std::fmt::Display,
) -> String {
    format!(
        "fixture validation failed provider={} scenario={} file={} {message}",
        context.provider,
        context.scenario,
        context.path.display()
    )
}

pub(crate) fn testdata_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(service_root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(service_root.join("testdata"))
}

pub(crate) fn temp_testdata_root() -> TestResult<PathBuf> {
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!("conduit-fixture-validation-test-{suffix}")))
}

pub(crate) fn write_minimal_replay_fixture(
    root: &Path,
    provider: &str,
    scenario: &str,
) -> TestResult<()> {
    let replay_root = root.join("providers").join(provider).join("replay");
    let scenario_root = replay_root.join(scenario);
    create_dir_all(&scenario_root)?;
    write(
        replay_root.join("manifest.json"),
        format!(
            r#"{{"schema":"{REPLAY_MANIFEST_SCHEMA}","provider":"{provider}","scenarios":[{{"name":"{scenario}","path":"{scenario}/scenario.json","capture_source":"capture://test","redaction_status":"normalized-no-secrets","stable_assertions":["shape"]}}]}}"#
        ),
    )?;
    write(
        scenario_root.join("scenario.json"),
        format!(
            r#"{{"schema":"{REPLAY_SCENARIO_SCHEMA}","provider":"{provider}","name":"{scenario}","capture_source":"capture://test","redaction_status":"normalized-no-secrets","ignored_fields":["cwd"],"observation":{{"provider_caveats":["Official ACP SDK owns raw JSON-RPC transport; Conduit validates curated replay frames here."],"dynamic_ignored_fields":["cwd"],"raw_capture_safe_to_promote":false,"curated_replay_safe_to_promote":true,"scrubbed_fields":["cwd"]}}}}"#
        ),
    )?;
    write(
        scenario_root.join("frames.jsonl"),
        r#"{"stream":"observation","source":"capture://test/raw","curated":true}"#,
    )?;
    write(
        scenario_root.join("expected-events.jsonl"),
        format!(
            r#"{{"kind":"provider_connected","provider":"{provider}","session_id":null,"payload":{{}}}}"#
        ),
    )?;
    write(
        scenario_root.join("expected-snapshot.json"),
        format!(r#"{{"provider":"{provider}","connection_state":"ready","live_sessions":[]}}"#),
    )?;
    Ok(())
}

pub(crate) fn require_message_parts(message: &str, parts: &[&str]) -> TestResult<()> {
    let missing = parts
        .iter()
        .filter(|part| !message.contains(**part))
        .copied()
        .collect::<Vec<_>>();
    if missing.is_empty() {
        return Ok(());
    }
    Err(format!("message {message:?} was missing parts {missing:?}").into())
}

fn forbidden_relative_component(component: Component<'_>) -> bool {
    matches!(
        component,
        Component::ParentDir | Component::RootDir | Component::Prefix(_)
    )
}

impl<'a, 'p> ValidationContext<'a, 'p> {
    pub(crate) fn with_path<'b>(&self, path: &'b Path) -> ValidationContext<'a, 'b> {
        ValidationContext {
            provider: self.provider,
            scenario: self.scenario,
            path,
        }
    }
}
