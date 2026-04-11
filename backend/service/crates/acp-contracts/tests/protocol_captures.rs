//! Regression tests for captured provider protocol fixtures.

use acp_contracts::{
    LockedMethod, load_locked_contract_bundle, validate_locked_cancel_notification,
    validate_locked_request_envelope, validate_locked_response_envelope,
};
use agent_client_protocol_schema as _;
use jsonschema as _;
use serde as _;
use serde_json::Value;
use sha2 as _;
use std::collections::BTreeMap;
use std::error::Error;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use toml as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

#[test]
fn provider_protocol_captures_stay_inside_locked_contract_subset() -> TestResult<()> {
    let bundle = load_locked_contract_bundle()?;
    for provider in ["claude", "copilot", "codex"] {
        let root = testdata_root()?
            .join("providers")
            .join(provider)
            .join("protocol");
        for stem in ["initialize", "minimal-flow"] {
            validate_capture(&bundle, &root, stem)?;
        }
    }
    Ok(())
}

fn validate_capture(
    bundle: &acp_contracts::ContractBundle,
    root: &Path,
    stem: &str,
) -> TestResult<()> {
    let requests = read_jsonl(&root.join(format!("{stem}.requests.jsonl")))?;
    let responses = read_jsonl(&root.join(format!("{stem}.responses.jsonl")))?;
    let mut methods_by_id = BTreeMap::new();
    for request in requests {
        let method = request
            .get("method")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("{stem} request missing method"))?;
        if method == "session/cancel" {
            validate_locked_cancel_notification(bundle, &request)?;
        } else {
            let locked = validate_locked_request_envelope(bundle, &request)?;
            if let Some(id) = envelope_id(&request) {
                methods_by_id.insert(id, locked);
            }
        }
    }
    for response in responses {
        let id = envelope_id(&response).ok_or_else(|| format!("{stem} response missing id"))?;
        let method = methods_by_id
            .get(&id)
            .copied()
            .ok_or_else(|| format!("{stem} response id {id} did not match a request"))?;
        if method != LockedMethod::SessionCancel {
            validate_locked_response_envelope(bundle, method, &response)?;
        }
    }
    Ok(())
}

fn read_jsonl(path: &Path) -> TestResult<Vec<Value>> {
    let contents = read_to_string(path)?;
    let mut values = Vec::new();
    for line in contents.lines().filter(|line| !line.is_empty()) {
        values.push(serde_json::from_str(line)?);
    }
    if values.is_empty() {
        return Err(format!("{} is empty", path.display()).into());
    }
    Ok(values)
}

fn envelope_id(envelope: &Value) -> Option<String> {
    let id = envelope.get("id")?;
    if let Some(value) = id.as_u64() {
        return Some(value.to_string());
    }
    id.as_str().map(str::to_owned)
}

fn testdata_root() -> TestResult<PathBuf> {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(service_root) = manifest_dir.ancestors().nth(2) else {
        return Err("could not resolve backend service root".into());
    };
    Ok(service_root.join("testdata"))
}
