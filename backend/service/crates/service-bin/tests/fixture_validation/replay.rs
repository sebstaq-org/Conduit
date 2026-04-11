//! Replay fixture library validation.

use super::common::{
    REPLAY_MANIFEST_SCHEMA, REPLAY_SCENARIO_SCHEMA, REQUIRED_SCENARIO_FILES, ValidationContext,
    ValidationReport, ValidationResult, array_field, failure, is_raw_wire_event_frame, read_json,
    read_jsonl, require_capture_metadata, require_dynamic_field_metadata, require_file,
    require_matching_field, require_present, require_string_array, require_string_eq,
    require_string_field, scenario_path_from_manifest, string_field,
};
use super::hygiene::validate_fixture_file_hygiene;
use acp_contracts::{LockedMethod, load_locked_contract_bundle, validate_locked_response_envelope};
use serde_json::Value;
use serde_json::json;
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
    validate_session_load_replay_contract(context, &scenario)?;
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

fn validate_session_load_replay_contract(
    context: ValidationContext<'_, '_>,
    scenario: &Value,
) -> ValidationResult<()> {
    let Some(session_load) = scenario
        .get("replay")
        .and_then(|replay| replay.get("session_load"))
    else {
        return Ok(());
    };
    let result = session_load
        .get("result")
        .ok_or_else(|| failure(context, "session_load replay was missing result"))?;
    let envelope = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "result": result,
    });
    let bundle = load_locked_contract_bundle().map_err(|error| {
        failure(
            context,
            format!("could not load locked ACP schema: {error}"),
        )
    })?;
    validate_locked_response_envelope(&bundle, LockedMethod::SessionLoad, &envelope).map_err(
        |error| {
            failure(
                context,
                format!("session_load response drifted from locked schema: {error}"),
            )
        },
    )?;

    if context.scenario != "session-load-known-session" {
        return Ok(());
    }
    let replay_updates = array_field(context, session_load, "replay_updates")?;
    if replay_updates.is_empty() {
        return Err(failure(
            context,
            "session-load-known-session must include load-time replay_updates",
        ));
    }
    for update in replay_updates {
        let variant = string_field(context, update, "sessionUpdate")?;
        if !is_official_session_update_variant(variant) {
            return Err(failure(
                context,
                format!("unsupported sessionUpdate variant {variant}"),
            ));
        }
    }
    validate_continuation_context_oracle(context, scenario, replay_updates)?;
    let expected_kinds = array_field(context, scenario, "expected_event_kinds")?;
    if !expected_kinds
        .iter()
        .filter_map(Value::as_str)
        .any(|kind| kind == "session_replay_update")
    {
        return Err(failure(
            context,
            "session-load-known-session must expect session_replay_update events",
        ));
    }
    Ok(())
}

fn validate_continuation_context_oracle(
    context: ValidationContext<'_, '_>,
    scenario: &Value,
    replay_updates: &[Value],
) -> ValidationResult<()> {
    let session_prompt = scenario
        .get("replay")
        .and_then(|replay| replay.get("session_prompt"))
        .ok_or_else(|| {
            failure(
                context,
                "session-load-known-session must define session_prompt replay",
            )
        })?;
    validate_continuation_context_declaration(context, session_prompt, replay_updates)?;
    validate_continuation_consumer_assertion(context, scenario)
}

fn validate_continuation_context_declaration(
    context: ValidationContext<'_, '_>,
    session_prompt: &Value,
    replay_updates: &[Value],
) -> ValidationResult<()> {
    if session_prompt
        .get("requires_loaded_replay")
        .and_then(Value::as_bool)
        != Some(true)
    {
        return Err(failure(
            context,
            "session-load-known-session continuation oracle must require loaded replay history",
        ));
    }

    let expected_variants = array_field(context, session_prompt, "expected_history_variants")?;
    let actual_variants = replay_updates
        .iter()
        .map(|update| string_field(context, update, "sessionUpdate").map(ToOwned::to_owned))
        .collect::<ValidationResult<Vec<_>>>()?;
    let expected_variants = expected_variants
        .iter()
        .map(|variant| {
            variant
                .as_str()
                .map(ToOwned::to_owned)
                .ok_or_else(|| failure(context, "expected_history_variants must contain strings"))
        })
        .collect::<ValidationResult<Vec<_>>>()?;
    if actual_variants != expected_variants {
        return Err(failure(
            context,
            format!(
                "continuation oracle variants {expected_variants:?} did not match replay updates {actual_variants:?}"
            ),
        ));
    }

    let expected_text = array_field(context, session_prompt, "expected_history_text_includes")?;
    if expected_text.is_empty() {
        return Err(failure(
            context,
            "continuation oracle must include expected replay text markers",
        ));
    }
    Ok(())
}

fn validate_continuation_consumer_assertion(
    context: ValidationContext<'_, '_>,
    scenario: &Value,
) -> ValidationResult<()> {
    let sequence = array_field(context, scenario, "consumer_sequence")?;
    let has_context_assertion = sequence.iter().any(|operation| {
        operation.get("command").and_then(Value::as_str) == Some("session/prompt")
            && operation
                .get("assert_loaded_replay_context_used")
                .and_then(Value::as_bool)
                == Some(true)
    });
    if !has_context_assertion {
        return Err(failure(
            context,
            "consumer_sequence must assert loaded replay context use on session/prompt",
        ));
    }
    Ok(())
}

fn is_official_session_update_variant(variant: &str) -> bool {
    matches!(
        variant,
        "user_message_chunk"
            | "agent_message_chunk"
            | "agent_thought_chunk"
            | "tool_call"
            | "tool_call_update"
            | "plan"
            | "available_commands_update"
            | "current_mode_update"
            | "config_option_update"
            | "session_info_update"
    )
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
