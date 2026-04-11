//! Replay fixture library validation.

use super::common::{
    REPLAY_MANIFEST_SCHEMA, REPLAY_SCENARIO_SCHEMA, REQUIRED_SCENARIO_FILES, ValidationContext,
    ValidationReport, ValidationResult, array_field, failure, is_raw_wire_event_frame, read_json,
    read_jsonl, require_capture_metadata, require_dynamic_field_metadata, require_file,
    require_matching_field, require_present, require_string_array, require_string_eq,
    require_string_field, scenario_path_from_manifest, string_field,
};
use super::hygiene::validate_fixture_file_hygiene;
use serde_json::Value;
use std::path::Path;

pub(crate) fn validate_replay_provider(
    testdata_root: &Path,
    provider: &str,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let replay_root = testdata_root
        .join("providers")
        .join(provider)
        .join("replay");
    let manifest_path = replay_root.join("manifest.json");
    let manifest_context = ValidationContext {
        provider,
        scenario: "<manifest>",
        path: &manifest_path,
    };
    require_file(manifest_context)?;
    let manifest = read_json(manifest_context)?;
    require_string_eq(
        manifest_context,
        &manifest,
        "schema",
        REPLAY_MANIFEST_SCHEMA,
        "manifest schema",
    )?;
    require_string_eq(
        manifest_context,
        &manifest,
        "provider",
        provider,
        "manifest provider",
    )?;
    let scenarios = array_field(manifest_context, &manifest, "scenarios")?;
    if scenarios.is_empty() {
        return Err(failure(
            manifest_context,
            "manifest scenarios must not be empty",
        ));
    }

    for entry in scenarios {
        validate_manifest_scenario(provider, &replay_root, entry, report)?;
    }
    Ok(())
}

fn validate_manifest_scenario(
    provider: &str,
    replay_root: &Path,
    entry: &Value,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let manifest_path = replay_root.join("manifest.json");
    let manifest_context = ValidationContext {
        provider,
        scenario: "<manifest>",
        path: &manifest_path,
    };
    let name = string_field(manifest_context, entry, "name")?;
    let path_text = string_field(manifest_context, entry, "path")?;
    let scenario_path =
        scenario_path_from_manifest(manifest_context, replay_root, name, path_text)?;
    let context = ValidationContext {
        provider,
        scenario: name,
        path: &scenario_path,
    };
    require_capture_metadata(manifest_context, entry)?;
    require_string_array(manifest_context, entry, "stable_assertions")?;
    require_required_scenario_files(context)?;

    let scenario = read_json(context)?;
    validate_scenario_metadata(context, entry, &scenario)?;
    validate_expected_events(
        context,
        &scenario_path.with_file_name("expected-events.jsonl"),
    )?;
    validate_expected_snapshot(
        context,
        &scenario,
        &scenario_path.with_file_name("expected-snapshot.json"),
    )?;
    validate_replay_frames(context, &scenario, report)?;
    validate_fixture_file_hygiene(context.path, provider, name)?;
    Ok(())
}

fn validate_scenario_metadata(
    context: ValidationContext<'_, '_>,
    manifest_entry: &Value,
    scenario: &Value,
) -> ValidationResult<()> {
    require_string_eq(
        context,
        scenario,
        "schema",
        REPLAY_SCENARIO_SCHEMA,
        "scenario schema",
    )?;
    require_string_eq(
        context,
        scenario,
        "provider",
        context.provider,
        "scenario provider",
    )?;
    require_string_eq(context, scenario, "name", context.scenario, "scenario name")?;
    require_capture_metadata(context, scenario)?;
    require_matching_field(context, manifest_entry, scenario, "capture_source")?;
    require_matching_field(context, manifest_entry, scenario, "redaction_status")?;
    require_dynamic_field_metadata(context, scenario)
}

fn validate_expected_events(
    scenario_context: ValidationContext<'_, '_>,
    path: &Path,
) -> ValidationResult<()> {
    let context = scenario_context.with_path(path);
    let events = read_jsonl(context)?;
    for event in events {
        require_string_field(context, &event, "kind")?;
        require_string_eq(
            context,
            &event,
            "provider",
            scenario_context.provider,
            "event provider",
        )?;
        require_present(context, &event, "session_id")?;
        require_present(context, &event, "payload")?;
        if !event.get("payload").is_some_and(Value::is_object) {
            return Err(failure(context, "event payload must be an object"));
        }
    }
    Ok(())
}

fn validate_expected_snapshot(
    scenario_context: ValidationContext<'_, '_>,
    scenario: &Value,
    path: &Path,
) -> ValidationResult<()> {
    let context = scenario_context.with_path(path);
    let snapshot = read_json(context)?;
    require_string_eq(
        context,
        &snapshot,
        "provider",
        scenario_context.provider,
        "snapshot provider",
    )?;
    require_string_field(context, &snapshot, "connection_state")?;
    let sessions = array_field(context, &snapshot, "live_sessions")?;
    for session in sessions {
        validate_session_identity_provider(context, session)?;
    }
    if scenario.get("prompt").is_some() {
        require_present(context, &snapshot, "last_prompt")?;
        if snapshot.get("last_prompt").is_some_and(Value::is_null) {
            return Err(failure(context, "prompt scenario requires last_prompt"));
        }
    }
    Ok(())
}

fn validate_session_identity_provider(
    context: ValidationContext<'_, '_>,
    session: &Value,
) -> ValidationResult<()> {
    let Some(identity) = session.get("identity") else {
        return Ok(());
    };
    require_string_eq(
        context,
        identity,
        "provider",
        context.provider,
        "session identity provider",
    )
}

fn validate_replay_frames(
    scenario_context: ValidationContext<'_, '_>,
    scenario: &Value,
    report: &mut ValidationReport,
) -> ValidationResult<()> {
    let path = scenario_context.path.with_file_name("frames.jsonl");
    let context = scenario_context.with_path(&path);
    let frames = read_jsonl(context)?;
    if frames.iter().any(is_raw_wire_event_frame) {
        return Ok(());
    }
    require_replay_transport_gap_metadata(context, scenario)?;
    report.replay_transport_gaps.insert(format!(
        "provider={} scenario={} file={}",
        context.provider,
        context.scenario,
        context.path.display()
    ));
    Ok(())
}

fn require_replay_transport_gap_metadata(
    context: ValidationContext<'_, '_>,
    scenario: &Value,
) -> ValidationResult<()> {
    let observation = scenario
        .get("observation")
        .ok_or_else(|| failure(context, "missing replay raw transport coverage metadata"))?;
    if observation
        .get("raw_capture_safe_to_promote")
        .and_then(Value::as_bool)
        != Some(false)
    {
        return Err(failure(
            context,
            "raw transport gap must set raw_capture_safe_to_promote=false",
        ));
    }
    let caveats = array_field(context, observation, "provider_caveats")?;
    if !caveats
        .iter()
        .filter_map(Value::as_str)
        .any(|entry| entry.contains("Official ACP SDK") && entry.contains("raw JSON-RPC transport"))
    {
        return Err(failure(
            context,
            "raw transport gap must name the official ACP SDK raw transport limitation",
        ));
    }
    Ok(())
}

fn require_required_scenario_files(context: ValidationContext<'_, '_>) -> ValidationResult<()> {
    let Some(dir) = context.path.parent() else {
        return Err(failure(context, "scenario path had no parent"));
    };
    for file_name in REQUIRED_SCENARIO_FILES {
        let path = dir.join(file_name);
        require_file(context.with_path(&path))?;
    }
    Ok(())
}
