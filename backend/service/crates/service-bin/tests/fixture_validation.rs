//! Mechanical validation for committed ACP replay and protocol fixtures.

use acp_core as _;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use app_api as _;
use axum as _;
use futures_util as _;
use regex as _;
use serde as _;
use serde_json as _;
use service_runtime as _;
use std::fs::{remove_dir_all, write};
use std::path::Path;
use thiserror as _;
use tokio as _;
use tokio_tungstenite as _;
use tower_http as _;

#[path = "fixture_validation/support.rs"]
mod support;

use support::{
    TestResult, ValidationContext, ValidationReport, require_message_parts, temp_testdata_root,
    testdata_root, validate_fixture_library, validate_hygiene_text, validate_replay_provider,
    write_minimal_replay_fixture,
};

#[test]
fn committed_replay_and_protocol_fixtures_validate() -> TestResult<()> {
    validate_fixture_library(&testdata_root()?).map_err(Into::into)
}

#[test]
fn missing_manifest_field_fails_with_context() -> TestResult<()> {
    let root = temp_testdata_root()?;
    write_minimal_replay_fixture(&root, "codex", "prompt-agent-text")?;
    let manifest_path = root
        .join("providers")
        .join("codex")
        .join("replay")
        .join("manifest.json");
    write(
        &manifest_path,
        r#"{"provider":"codex","scenarios":[{"name":"prompt-agent-text","path":"prompt-agent-text/scenario.json","capture_source":"capture://test","redaction_status":"normalized-no-secrets","stable_assertions":["shape"]}]}"#,
    )?;

    let message = validate_replay_provider(&root, "codex", &mut ValidationReport::default())
        .err()
        .ok_or("manifest without schema unexpectedly passed")?;
    remove_dir_all(root)?;
    require_message_parts(
        &message,
        &[
            "provider=codex",
            "scenario=<manifest>",
            "manifest.json",
            "schema",
        ],
    )
}

#[test]
fn bad_expected_event_shape_fails_with_context() -> TestResult<()> {
    let root = temp_testdata_root()?;
    write_minimal_replay_fixture(&root, "codex", "prompt-agent-text")?;
    let event_path = root
        .join("providers")
        .join("codex")
        .join("replay")
        .join("prompt-agent-text")
        .join("expected-events.jsonl");
    write(
        &event_path,
        r#"{"kind":"provider_connected","provider":"codex","session_id":null}"#,
    )?;

    let message = validate_replay_provider(&root, "codex", &mut ValidationReport::default())
        .err()
        .ok_or("event without payload unexpectedly passed")?;
    remove_dir_all(root)?;
    require_message_parts(
        &message,
        &[
            "provider=codex",
            "scenario=prompt-agent-text",
            "expected-events.jsonl",
            "payload",
        ],
    )
}

#[test]
fn local_path_leakage_fails_hygiene_scan() -> TestResult<()> {
    let path = Path::new("backend/service/testdata/providers/codex/replay/leak/scenario.json");
    let message = validate_hygiene_text(
        ValidationContext {
            provider: "codex",
            scenario: "leak",
            path,
        },
        r#"{"capture_source":"/srv/devops/private"}"#,
    )
    .err()
    .ok_or("local path leakage unexpectedly passed")?;
    require_message_parts(&message, &["provider=codex", "scenario=leak", "/srv/"])
}

#[test]
fn provider_name_mismatch_fails_with_context() -> TestResult<()> {
    let root = temp_testdata_root()?;
    write_minimal_replay_fixture(&root, "codex", "prompt-agent-text")?;
    let scenario_path = root
        .join("providers")
        .join("codex")
        .join("replay")
        .join("prompt-agent-text")
        .join("scenario.json");
    write(
        &scenario_path,
        r#"{"schema":"conduit.acp_replay.scenario.v1","provider":"claude","name":"other","capture_source":"capture://test","redaction_status":"normalized-no-secrets","ignored_fields":["cwd"],"observation":{"provider_caveats":["Official ACP SDK owns raw JSON-RPC transport; Conduit validates curated replay frames here."],"dynamic_ignored_fields":["cwd"],"raw_capture_safe_to_promote":false,"curated_replay_safe_to_promote":true,"scrubbed_fields":["cwd"]}}"#,
    )?;

    let message = validate_replay_provider(&root, "codex", &mut ValidationReport::default())
        .err()
        .ok_or("provider/name mismatch unexpectedly passed")?;
    remove_dir_all(root)?;
    require_message_parts(
        &message,
        &[
            "provider=codex",
            "scenario=prompt-agent-text",
            "scenario provider claude",
        ],
    )
}
