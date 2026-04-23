//! Miscellaneous runtime command dispatch tests.

mod support;

use app_api as _;
#[cfg(feature = "benchmarks")]
use criterion as _;
use schemars as _;
use serde as _;
use serde_json::json;
use std::sync::{Arc, Mutex};
use support::{FakeState, TestResult, assert_ok, command, runtime};
use thiserror as _;

#[test]
fn provider_snapshot_alias_is_not_supported() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command("1", "provider/snapshot", "codex", json!({})));

    if response.ok {
        return Err("provider/snapshot unexpectedly succeeded".into());
    }
    let error_code = response.error.map(|error| error.code);
    if error_code != Some("unsupported_command".to_owned()) {
        return Err(format!("expected unsupported_command, got {error_code:?}").into());
    }
    Ok(())
}

#[test]
fn sessions_watch_returns_minimal_ack() -> TestResult<()> {
    let state = Arc::new(Mutex::new(FakeState::default()));
    let mut runtime = runtime(state)?;
    let response = runtime.dispatch(command("1", "sessions/watch", "all", json!({})));

    assert_ok(&response)?;
    if response.result == json!({ "subscribed": true }) {
        return Ok(());
    }
    Err(format!("unexpected sessions/watch result {}", response.result).into())
}
