//! Toolchain locking checks for the repository.

use crate::error::{Error, Result};
use crate::process::capture;
use serde::Deserialize;
use std::fs::read_to_string;
use std::path::Path;

const REQUIRED_LINTS: [&str; 7] = [
    "deprecated-safe-2024",
    "missing-unsafe-on-extern",
    "unsafe-attr-outside-unsafe",
    "unsafe-op-in-unsafe-fn",
    "static-mut-refs",
    "unexpected-cfgs",
    "unfulfilled-lint-expectations",
];

#[derive(Debug, Deserialize)]
struct RootPackage {
    engines: Option<Engines>,
    #[serde(rename = "packageManager")]
    package_manager: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Engines {
    node: Option<String>,
    pnpm: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolchainFile {
    toolchain: ToolchainSpec,
}

#[derive(Debug, Deserialize)]
struct ToolchainSpec {
    channel: String,
}

#[derive(Debug)]
struct Snapshot {
    actual_node: String,
    actual_pnpm: String,
    actual_rust: Option<String>,
    expected_node: String,
    expected_pnpm: Option<String>,
    expected_rust: Option<String>,
    package_node: Option<String>,
    package_pnpm: Option<String>,
    rust_lint_help: String,
}

/// Verifies that the repo toolchain is pinned exactly as policy requires.
pub(crate) fn check(repo_root: &Path) -> Result<()> {
    let snapshot = load_snapshot(repo_root)?;
    let failures = collect_failures(&snapshot);
    if !failures.is_empty() {
        return Err(Error::policy(failures));
    }

    Ok(())
}

fn load_snapshot(repo_root: &Path) -> Result<Snapshot> {
    let package_path = repo_root.join("package.json");
    let package_contents = read_to_string(&package_path)
        .map_err(|source| Error::io(Some(package_path.clone()), source))?;
    let package: RootPackage =
        serde_json::from_str(&package_contents).map_err(|source| Error::Json {
            path: package_path,
            source,
        })?;
    let (package_node, package_pnpm) = match package.engines {
        Some(engines) => (engines.node, engines.pnpm),
        None => (None, None),
    };
    let nvmrc_path = repo_root.join(".nvmrc");
    let expected_node =
        read_to_string(&nvmrc_path).map_err(|source| Error::io(Some(nvmrc_path), source))?;
    let toolchain_path = repo_root.join("backend/service/rust-toolchain.toml");
    let toolchain_contents = read_to_string(&toolchain_path)
        .map_err(|source| Error::io(Some(toolchain_path.clone()), source))?;
    let toolchain: ToolchainFile =
        toml::from_str(&toolchain_contents).map_err(|source| Error::Toml {
            path: toolchain_path,
            source,
        })?;
    let actual_node = capture("node", &["-v"], repo_root)?;
    let actual_pnpm = capture("pnpm", &["-v"], repo_root)?;
    let actual_rust = capture("rustc", &["-V"], repo_root)?;
    let rust_lint_help = capture("rustc", &["-W", "help"], repo_root)?;

    Ok(Snapshot {
        actual_node: actual_node.trim().to_owned(),
        actual_pnpm: actual_pnpm.trim().to_owned(),
        actual_rust: actual_rust
            .split_whitespace()
            .nth(1)
            .map(std::borrow::ToOwned::to_owned),
        expected_node: expected_node.trim().to_owned(),
        expected_pnpm: package
            .package_manager
            .as_deref()
            .and_then(|manager| manager.strip_prefix("pnpm@"))
            .map(std::borrow::ToOwned::to_owned),
        expected_rust: Some(toolchain.toolchain.channel),
        package_node,
        package_pnpm,
        rust_lint_help,
    })
}

fn collect_failures(snapshot: &Snapshot) -> Vec<String> {
    let mut failures = Vec::new();

    if snapshot.actual_node != format!("v{}", snapshot.expected_node) {
        failures.push(format!(
            "Node version mismatch: expected v{}, got {}.",
            snapshot.expected_node, snapshot.actual_node
        ));
    }

    if snapshot.package_node.as_deref() != Some(snapshot.expected_node.as_str()) {
        failures.push(format!(
            "package.json engines.node must match .nvmrc ({}).",
            snapshot.expected_node
        ));
    }

    match &snapshot.expected_pnpm {
        Some(expected_pnpm) => {
            if snapshot.actual_pnpm != *expected_pnpm {
                failures.push(format!(
                    "pnpm version mismatch: expected {}, got {}.",
                    expected_pnpm, snapshot.actual_pnpm
                ));
            }

            if snapshot.package_pnpm.as_deref() != Some(expected_pnpm.as_str()) {
                failures.push(format!(
                    "package.json engines.pnpm must match packageManager ({}).",
                    expected_pnpm
                ));
            }
        }
        None => failures
            .push("package.json must pin packageManager to an exact pnpm version.".to_owned()),
    }

    match snapshot.expected_rust.as_deref() {
        Some(expected_rust) => {
            if snapshot.actual_rust.as_deref() != Some(expected_rust) {
                let actual_rust = snapshot.actual_rust.as_deref().unwrap_or("unknown");
                failures.push(format!(
                    "Rust version mismatch: expected {}, got {}.",
                    expected_rust, actual_rust
                ));
            }
        }
        None => failures
            .push("backend/service/rust-toolchain.toml must pin an exact channel.".to_owned()),
    }

    for lint in REQUIRED_LINTS {
        if !snapshot.rust_lint_help.contains(lint) {
            let rust_version = snapshot.actual_rust.as_deref().unwrap_or("unknown");
            failures.push(format!(
                "Pinned rustc {} is missing required lint {}.",
                rust_version, lint
            ));
        }
    }

    failures
}

#[cfg(test)]
mod tests {
    use super::{Snapshot, collect_failures};

    fn baseline_snapshot() -> Snapshot {
        Snapshot {
            actual_node: "v24.14.0".to_owned(),
            actual_pnpm: "10.30.3".to_owned(),
            actual_rust: Some("1.93.1".to_owned()),
            expected_node: "24.14.0".to_owned(),
            expected_pnpm: Some("10.30.3".to_owned()),
            expected_rust: Some("1.93.1".to_owned()),
            package_node: Some("24.14.0".to_owned()),
            package_pnpm: Some("10.30.3".to_owned()),
            rust_lint_help: super::REQUIRED_LINTS.join("\n"),
        }
    }

    #[test]
    fn accepts_matching_toolchain_lock() {
        assert!(collect_failures(&baseline_snapshot()).is_empty());
    }

    #[test]
    fn rejects_missing_required_rust_lint() {
        let mut snapshot = baseline_snapshot();
        snapshot.rust_lint_help.clear();
        let failures = collect_failures(&snapshot);

        assert!(
            failures
                .iter()
                .any(|failure| failure.contains("missing required lint deprecated-safe-2024"))
        );
    }
}
