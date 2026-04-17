//! Canonical proof-pack regression checks for Codex ACP plan-mode PR195.

use acp_contracts as _;
use acp_core as _;
use acp_discovery as _;
use agent_client_protocol as _;
use async_trait as _;
use schemars as _;
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeSet;
use std::error::Error;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use thiserror as _;
use tokio as _;
use tokio_util as _;
use tracing as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;
const REQUIRED_ROWS: [&str; 15] = [
    "patched_adapter_runtime_identity",
    "collaboration_mode_config_option_exposed",
    "session_set_mode_plan_invalid_params",
    "session_set_config_option_plan_direct",
    "session_set_config_option_plan_conduit_success",
    "structured_question_carrier",
    "question_payload_shape_and_options",
    "question_answer_correlation_and_sequence",
    "selected_answer_payload",
    "answer_other_payload_with_meta",
    "cancel_pending_question_behavior",
    "invalid_option_behavior",
    "continuation_after_plan_and_session_load",
    "typed_terminal_plan_signal",
    "explicit_implement_plan_action",
];

#[derive(Debug, Deserialize)]
struct ProofIndex {
    rows: Vec<ProofRow>,
}

#[derive(Debug, Deserialize)]
struct ProofRow {
    row_id: String,
    status: ProofStatus,
    sources: Vec<ProofSource>,
    proof_of_absence: Option<ProofOfAbsence>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ProofStatus {
    Verified,
    Missing,
}

#[derive(Debug, Deserialize)]
struct ProofSource {
    run_id: String,
    artifact: String,
    command: String,
}

#[derive(Debug, Deserialize)]
struct ProofOfAbsence {
    command: String,
    observed_result: Value,
}

#[test]
fn codex_pr195_canonical_index_is_decision_complete() -> TestResult<()> {
    let index: ProofIndex = read_json(&canonical_root()?.join("proof-index.json"))?;
    if index.rows.is_empty() {
        return Err("proof-index rows must not be empty".into());
    }

    assert_required_rows(&index)?;
    let missing_rows = validate_row_shapes(&index)?;

    let expected_missing: BTreeSet<&str> = BTreeSet::from(["explicit_implement_plan_action"]);
    if missing_rows != expected_missing {
        return Err(format!(
            "unexpected missing rows: expected {:?}, got {:?}",
            expected_missing, missing_rows
        )
        .into());
    }

    Ok(())
}

fn assert_required_rows(index: &ProofIndex) -> TestResult<()> {
    for required in REQUIRED_ROWS {
        let exists = index.rows.iter().any(|row| row.row_id == required);
        if !exists {
            return Err(format!("missing required proof row: {required}").into());
        }
    }
    Ok(())
}

fn validate_row_shapes(index: &ProofIndex) -> TestResult<BTreeSet<&str>> {
    let mut missing_rows = BTreeSet::new();
    for row in &index.rows {
        validate_sources(row)?;
        match row.status {
            ProofStatus::Verified => validate_verified_row(row)?,
            ProofStatus::Missing => {
                validate_missing_row(row)?;
                missing_rows.insert(row.row_id.as_str());
            }
        }
    }
    Ok(missing_rows)
}

fn validate_sources(row: &ProofRow) -> TestResult<()> {
    if row.sources.is_empty() {
        return Err(format!("row {} has no sources", row.row_id).into());
    }
    for source in &row.sources {
        if source.run_id.trim().is_empty()
            || source.artifact.trim().is_empty()
            || source.command.trim().is_empty()
        {
            return Err(format!("row {} contains empty source fields", row.row_id).into());
        }
    }
    Ok(())
}

fn validate_verified_row(row: &ProofRow) -> TestResult<()> {
    if row.proof_of_absence.is_some() {
        return Err(format!(
            "verified row {} must not carry proof_of_absence",
            row.row_id
        )
        .into());
    }
    Ok(())
}

fn validate_missing_row(row: &ProofRow) -> TestResult<()> {
    let Some(proof) = &row.proof_of_absence else {
        return Err(format!("missing row {} must include proof_of_absence", row.row_id).into());
    };
    if proof.command.trim().is_empty() {
        return Err(format!("missing row {} has empty proof command", row.row_id).into());
    }
    if proof.observed_result.is_null() {
        return Err(format!("missing row {} has null observed_result", row.row_id).into());
    }
    Ok(())
}

#[test]
fn codex_pr195_fixture_pack_deserializes() -> TestResult<()> {
    let root = canonical_root()?;
    let fixture_files = [
        "run-manifest.json",
        "fixtures/request-permission-sequences.json",
        "fixtures/answer-payloads.json",
        "fixtures/terminal-and-absence.json",
        "fixtures/continuation-load.json",
        "fixtures/backend-interaction-bridge-live.json",
        "thread-lens-reference/codex-plan-shape-excerpt.json",
    ];

    for relative in fixture_files {
        let path = root.join(relative);
        let value: Value = read_json(&path)?;
        if value.is_null() {
            return Err(format!("fixture {} deserialized to null", relative).into());
        }
    }

    let backend_live: Value =
        read_json(&root.join("fixtures/backend-interaction-bridge-live.json"))?;
    validate_backend_live_fixture(&backend_live)?;

    Ok(())
}

fn validate_backend_live_fixture(value: &Value) -> TestResult<()> {
    require_u64_gt_zero(
        value,
        "/verified/session_set_config_option_plan/success_count",
        "backend live fixture must prove at least one successful set_config_option",
    )?;
    require_u64_gt_zero(
        value,
        "/verified/structured_question_carrier/request_permission_count",
        "backend live fixture must prove request_permission_count > 0",
    )?;
    require_u64_gt_zero(
        value,
        "/verified/normalized_runtime_events/interaction_request_event_count",
        "backend live fixture must prove interaction_request_event_count > 0",
    )?;
    require_bool_true(
        value,
        "/verified/response_mapping/answer_other_meta_present",
        "backend live fixture must prove answer_other meta payload presence",
    )?;
    require_string_equals(
        value,
        "/verified/response_mapping/cancel_prompt_stop_reason",
        "cancelled",
    )?;
    require_string_equals(
        value,
        "/verified/response_mapping/invalid_option_prompt_stop_reason",
        "cancelled",
    )?;
    require_string_equals(
        value,
        "/verified/unknown_interaction_error/error/code",
        "invalid_params",
    )?;

    Ok(())
}

fn require_u64_gt_zero(value: &Value, pointer: &str, message: &str) -> TestResult<()> {
    let Some(actual) = value.pointer(pointer).and_then(Value::as_u64) else {
        return Err(format!("missing numeric proof field at {pointer}").into());
    };
    if actual == 0 {
        return Err(message.to_owned().into());
    }
    Ok(())
}

fn require_bool_true(value: &Value, pointer: &str, message: &str) -> TestResult<()> {
    let actual = value
        .pointer(pointer)
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !actual {
        return Err(message.to_owned().into());
    }
    Ok(())
}

fn require_string_equals(value: &Value, pointer: &str, expected: &str) -> TestResult<()> {
    let actual = value
        .pointer(pointer)
        .and_then(Value::as_str)
        .unwrap_or_default();
    if actual != expected {
        return Err(
            format!("unexpected value at {pointer}: expected {expected}, got {actual}").into(),
        );
    }
    Ok(())
}

fn canonical_root() -> TestResult<PathBuf> {
    let testdata_root = testdata_root()?;
    Ok(testdata_root.join("providers/codex/plan-mode-pr195"))
}

fn testdata_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(service_root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(service_root.join("testdata"))
}

fn read_json<T>(path: &Path) -> TestResult<T>
where
    T: serde::de::DeserializeOwned,
{
    let contents = read_to_string(path)?;
    Ok(serde_json::from_str(&contents)?)
}
