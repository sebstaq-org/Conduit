//! Focused tests for the shared ACP replay oracle support.

use acp_contracts as _;
use acp_core as _;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use app_api as _;
use axum as _;
use futures_util as _;
use regex as _;
use serde as _;
use serde_json::json;
use service_runtime as _;
use session_store as _;
use std::error::Error;
use std::fs::{create_dir_all, remove_dir_all, write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror as _;
use tokio as _;
use tokio_tungstenite as _;
use tower_http as _;

#[path = "support/replay_oracle.rs"]
mod replay_oracle;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[test]
fn event_projection_keeps_stable_observation_fields() -> TestResult<()> {
    let event = json!({
        "v": 1,
        "type": "event",
        "event": {
            "sequence": 12,
            "kind": "session_observed",
            "provider": "codex",
            "session_id": "replay-session-1",
            "payload": { "observed_via": "session/list" }
        }
    });
    let projected = replay_oracle::normalize_event_oracle(event, &json!({}))?;

    if projected
        != json!({
            "kind": "session_observed",
            "provider": "codex",
            "session_id": "replay-session-1",
            "payload": { "observed_via": "session/list" }
        })
    {
        return Err(format!("unexpected event projection {projected}").into());
    }
    Ok(())
}

#[test]
fn snapshot_dynamic_fields_only_normalize_when_declared() -> TestResult<()> {
    let snapshot = json!({
        "provider": "codex",
        "connection_state": "ready",
        "live_sessions": [{ "cwd": "/srv/private/repo" }]
    });
    let declared = json!({ "ignored_fields": ["cwd"] });
    let undeclared = json!({});

    let normalized = replay_oracle::normalize_snapshot_oracle(snapshot.clone(), &declared)?;
    let stable = replay_oracle::normalize_snapshot_oracle(snapshot, &undeclared)?;

    if normalized["live_sessions"][0]["cwd"] != json!("/__dynamic_cwd__") {
        return Err(format!("cwd was not normalized: {normalized}").into());
    }
    if stable["live_sessions"][0]["cwd"] != json!("/srv/private/repo") {
        return Err(format!("undeclared cwd was normalized: {stable}").into());
    }
    Ok(())
}

#[test]
fn oracle_rejects_stable_field_mismatches() -> TestResult<()> {
    let root = temp_fixture_root()?;
    create_dir_all(&root)?;
    write(root.join("scenario.json"), "{}")?;
    write(
        root.join("expected-events.jsonl"),
        "{\"kind\":\"provider_connected\",\"provider\":\"codex\",\"session_id\":null,\"payload\":{}}\n",
    )?;
    write(
        root.join("expected-snapshot.json"),
        serde_json::to_string_pretty(&json!({
            "provider": "codex",
            "connection_state": "ready"
        }))?,
    )?;

    let scenario = json!({ "provider": "codex", "name": "stable-mismatch" });
    let error = replay_oracle::assert_expected_oracles(
        &root.join("scenario.json"),
        &scenario,
        &[json!({
            "event": {
                "kind": "provider_connected",
                "provider": "claude",
                "session_id": null,
                "payload": {}
            }
        })],
        &json!({
            "provider": "codex",
            "connection_state": "ready"
        }),
    )
    .err()
    .ok_or("oracle unexpectedly accepted a provider mismatch")?;

    let message = error.to_string();
    remove_dir_all(root)?;
    if !message.contains("provider=codex")
        || !message.contains("scenario=stable-mismatch")
        || !message.contains("expected-events.jsonl")
    {
        return Err(format!("mismatch lacked useful context: {message}").into());
    }
    Ok(())
}

fn temp_fixture_root() -> TestResult<PathBuf> {
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!("conduit-replay-oracle-test-{suffix}")))
}
