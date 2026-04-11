//! Explicit candidate promotion into committed replay fixture testdata.

use super::{invalid_capture, read_json, scenario_string, service_testdata_root};
use crate::artifact::write_json;
use crate::error::{Result, ServiceError};
use serde_json::{Value, json};
use std::fs::{copy, create_dir_all, read_to_string};
use std::path::{Path, PathBuf};

pub(super) fn promote(candidate_root: &Path, testdata_root: Option<PathBuf>) -> Result<()> {
    scan_candidate(candidate_root)?;
    let scenario = read_json(&candidate_root.join("scenario.json"))?;
    let provider = scenario_string(&scenario, "provider")?;
    let scenario_name = scenario_string(&scenario, "name")?;
    let testdata = testdata_root.unwrap_or_else(service_testdata_root);
    let destination = testdata
        .join("providers")
        .join(provider)
        .join("replay")
        .join(scenario_name);
    create_dir_all(&destination).map_err(|source| ServiceError::PreparePath {
        path: destination.clone(),
        source,
    })?;
    for file_name in [
        "scenario.json",
        "frames.jsonl",
        "expected-events.jsonl",
        "expected-snapshot.json",
    ] {
        copy(candidate_root.join(file_name), destination.join(file_name))?;
    }
    update_provider_manifest(&testdata, provider, scenario_name)?;
    super::run_replay_oracle_gate(None)
}

fn scan_candidate(root: &Path) -> Result<()> {
    for file_name in [
        "scenario.json",
        "frames.jsonl",
        "expected-events.jsonl",
        "expected-snapshot.json",
    ] {
        let path = root.join(file_name);
        let contents = read_to_string(&path)?;
        if let Some(hit) = scan_hit(&contents) {
            return Err(invalid_capture(&format!(
                "promotion scan hit {hit} in {}",
                path.display()
            )));
        }
    }
    Ok(())
}

fn scan_hit(contents: &str) -> Option<&'static str> {
    if contents.contains("/srv/") || contents.contains("/home/") || contents.contains("/Users/") {
        return Some("local-path");
    }
    if contents.contains("sk-")
        || contents.contains("ghp_")
        || contents.contains("xoxb-")
        || contents.contains("-----BEGIN")
    {
        return Some("secret-like-token");
    }
    None
}

fn update_provider_manifest(testdata: &Path, provider: &str, scenario: &str) -> Result<()> {
    let manifest_path = testdata
        .join("providers")
        .join(provider)
        .join("replay")
        .join("manifest.json");
    let mut manifest = read_json(&manifest_path)?;
    let scenarios = manifest
        .get_mut("scenarios")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| invalid_capture("provider replay manifest missing scenarios"))?;
    let replacement = json!({
        "name": scenario,
        "path": format!("{scenario}/scenario.json"),
        "capture_source": format!("capture://phase-2.2/{provider}/{scenario}"),
        "redaction_status": "curated-public-repo-safe-structural-scrub",
        "stable_assertions": [
            "provider",
            "connection_state",
            "event kind",
            "command result/error code",
            "session identity relations",
            "events_subscribe_cursor_backlog"
        ]
    });
    if let Some(existing) = scenarios
        .iter_mut()
        .find(|entry| entry.get("name").and_then(Value::as_str) == Some(scenario))
    {
        *existing = replacement;
    } else {
        scenarios.push(replacement);
    }
    write_json(manifest_path, &manifest)
}
