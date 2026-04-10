//! Isolation checks for proof artifacts.

use crate::error::{Result, ServiceError};
use acp_discovery::ProviderDiscovery;
use regex::Regex;
use serde_json::{Value, to_value};
use std::path::Path;
use std::sync::LazyLock;

use super::capture::ScenarioCapture;
use super::workspace::ProofWorkspace;

static ABSOLUTE_PATH_RE: LazyLock<std::result::Result<Regex, String>> = LazyLock::new(|| {
    Regex::new(r"/(?:home|tmp|srv|var|Users|opt|nix|etc|usr|private)(?:/[A-Za-z0-9._-]+)*")
        .map_err(|error| error.to_string())
});

/// Verifies that one discovery capture stays inside the isolated proof roots.
///
/// # Errors
///
/// Returns an error when raw discovery stdout, stderr, or the discovery payload
/// contains absolute paths outside the isolated proof workspace.
pub(crate) fn verify_discovery_capture(
    label: &str,
    proof: &ProofWorkspace,
    discovery: &ProviderDiscovery,
) -> Result<()> {
    let allowed_prefixes = allowed_prefixes(
        proof,
        &launcher_prefixes(
            &discovery.resolved_path,
            &discovery.launcher.executable.display().to_string(),
        ),
    );
    inspect_value(
        label,
        "discovery",
        &to_value(discovery).map_err(ServiceError::Json)?,
        &allowed_prefixes,
    )
}

/// Verifies that one scenario capture stays inside the isolated proof roots.
///
/// # Errors
///
/// Returns an error when the snapshot or captured envelopes leak absolute paths
/// outside the proof workspace.
pub(crate) fn verify_capture(
    label: &str,
    proof: &ProofWorkspace,
    capture: &ScenarioCapture,
) -> Result<()> {
    let allowed_prefixes = allowed_prefixes(
        proof,
        &launcher_prefixes(
            &capture.snapshot.discovery.resolved_path,
            &capture
                .snapshot
                .discovery
                .launcher
                .executable
                .display()
                .to_string(),
        ),
    );
    inspect_value(
        label,
        "snapshot",
        &to_value(&capture.snapshot).map_err(ServiceError::Json)?,
        &allowed_prefixes,
    )?;
    inspect_value(
        label,
        "requests",
        &to_value(&capture.requests).map_err(ServiceError::Json)?,
        &allowed_prefixes,
    )?;
    inspect_value(
        label,
        "responses",
        &to_value(&capture.responses).map_err(ServiceError::Json)?,
        &allowed_prefixes,
    )?;
    inspect_value(
        label,
        "events",
        &to_value(&capture.raw_events).map_err(ServiceError::Json)?,
        &allowed_prefixes,
    )
}

fn allowed_prefixes(proof: &ProofWorkspace, extra: &[String]) -> Vec<String> {
    let mut prefixes = vec![
        proof.cwd().display().to_string(),
        proof.home_root().display().to_string(),
    ];
    prefixes.extend(extra.iter().cloned());
    prefixes
}

fn launcher_prefixes(resolved_path: &str, executable_path: &str) -> Vec<String> {
    let mut prefixes = vec![resolved_path.to_owned()];
    if executable_path != resolved_path {
        prefixes.push(executable_path.to_owned());
    }
    prefixes.extend(path_prefixes(Path::new(resolved_path)));
    prefixes.extend(path_prefixes(Path::new(executable_path)));
    prefixes.sort();
    prefixes.dedup();
    prefixes
}

fn path_prefixes(path: &Path) -> Vec<String> {
    let mut prefixes = Vec::new();
    if let Some(parent) = path.parent() {
        prefixes.push(parent.display().to_string());
        if parent.file_name().and_then(|value| value.to_str()) == Some("bin")
            && let Some(install_root) = parent.parent()
        {
            prefixes.push(install_root.display().to_string());
            prefixes.push(install_root.join("lib").display().to_string());
            prefixes.push(install_root.join("lib/node_modules").display().to_string());
        }
    }
    prefixes
}

fn inspect_value(
    label: &str,
    context: &str,
    value: &Value,
    allowed_prefixes: &[String],
) -> Result<()> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => Ok(()),
        Value::String(text) => inspect_text(label, context, text, allowed_prefixes),
        Value::Array(values) => {
            for entry in values {
                inspect_value(label, context, entry, allowed_prefixes)?;
            }
            Ok(())
        }
        Value::Object(map) => {
            for value in map.values() {
                inspect_value(label, context, value, allowed_prefixes)?;
            }
            Ok(())
        }
    }
}

fn inspect_text(label: &str, context: &str, text: &str, allowed_prefixes: &[String]) -> Result<()> {
    let Some(regex) = ABSOLUTE_PATH_RE.as_ref().ok() else {
        return Ok(());
    };
    for candidate in regex.find_iter(text) {
        let path = candidate.as_str();
        if path_allowed(path, allowed_prefixes) {
            continue;
        }
        return Err(ServiceError::IsolationLeak {
            context: format!("{label}::{context}"),
            path: path.to_owned(),
        });
    }
    Ok(())
}

fn path_allowed(path: &str, allowed_prefixes: &[String]) -> bool {
    if allowed_prefixes
        .iter()
        .any(|allowed| path.starts_with(allowed))
    {
        return true;
    }
    if let Some(node_root) = node_install_root(path) {
        return allowed_prefixes
            .iter()
            .any(|allowed| allowed.starts_with(node_root) || node_root.starts_with(allowed));
    }
    false
}

fn node_install_root(path: &str) -> Option<&str> {
    let marker = "/versions/node/";
    let marker_index = path.find(marker)?;
    let version_start = marker_index + marker.len();
    let version_tail = &path[version_start..];
    let version_end = version_tail.find('/')?;
    Some(&path[..version_start + version_end])
}
