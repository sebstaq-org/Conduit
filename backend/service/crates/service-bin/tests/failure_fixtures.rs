//! Regression tests for synthetic failure wire fixtures.

use acp_contracts as _;
use acp_core::RawWireEvent;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use app_api as _;
use axum as _;
use futures_util as _;
use regex as _;
use serde as _;
use service_runtime as _;
use std::error::Error;
use std::fs::{read_dir, read_to_string};
use std::path::{Path, PathBuf};
use thiserror as _;
use tokio as _;
use tokio_tungstenite as _;
use tower_http as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[test]
fn failure_fixtures_deserialize_as_wire_events() -> TestResult<()> {
    let failure_root = testdata_root()?.join("failures");
    let mut fixture_count = 0usize;
    for entry in read_dir(failure_root)? {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            fixture_count += 1;
            read_wire_events(&path)?;
        }
    }
    if fixture_count == 0 {
        return Err("no failure fixtures found".into());
    }
    Ok(())
}

fn read_wire_events(path: &Path) -> TestResult<()> {
    let contents = read_to_string(path)?;
    let mut event_count = 0usize;
    for line in contents.lines().filter(|line| !line.is_empty()) {
        let _event: RawWireEvent = serde_json::from_str(line)?;
        event_count += 1;
    }
    if event_count == 0 {
        return Err(format!("{} is empty", path.display()).into());
    }
    Ok(())
}

fn testdata_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(service_root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(service_root.join("testdata"))
}
