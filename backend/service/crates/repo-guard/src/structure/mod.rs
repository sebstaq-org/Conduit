//! Repository structure policy enforcement.

mod files;
mod js;
mod js_runtime;
mod rust;
mod source;
mod source_ast;

use crate::error::{Error, Result};
use std::collections::HashMap;
use std::path::Path;

const ALLOWED_TOP_LEVEL: [&str; 7] = [
    "apps",
    "artifacts",
    "backend",
    "docs",
    "packages",
    "scripts",
    "vendor",
];
const FORBIDDEN_TOP_LEVEL: [&str; 6] = ["rust", "shared", "core", "utils", "misc", "tmp"];
const APPROVED_APPS: [&str; 2] = ["desktop", "frontend"];
const APPROVED_PACKAGES: [&str; 7] = [
    "app-client",
    "app-core",
    "app-protocol",
    "design-system-tokens",
    "session-client",
    "session-contracts",
    "session-model",
];
const APPROVED_CRATES: [&str; 13] = [
    "acp-contracts",
    "acp-core",
    "acp-discovery",
    "app-api",
    "app-protocol-export",
    "conduit-cli",
    "provider-claude",
    "provider-codex",
    "provider-copilot",
    "repo-guard",
    "service-bin",
    "service-runtime",
    "session-store",
];
const APPROVED_ARTIFACT_ROOTS: [&str; 2] = ["automated", "manual"];
const APPROVED_VENDOR_ROOTS: [&str; 1] = ["agent-client-protocol"];
const APPROVED_TESTDATA_ROOTS: [&str; 3] = ["failures", "golden", "providers"];
const IGNORED_TOP_LEVEL: [&str; 1] = ["node_modules"];
const ALLOWED_ARTIFACT_EXTENSIONS: [&str; 19] = [
    "", ".csv", ".gitkeep", ".gz", ".html", ".jpeg", ".jpg", ".json", ".jsonl", ".log", ".md",
    ".ndjson", ".pdf", ".png", ".svg", ".tgz", ".txt", ".webp", ".zip",
];
const ALLOWED_VENDOR_EXTENSIONS: [&str; 9] = [
    "", ".gitkeep", ".json", ".lock", ".md", ".toml", ".txt", ".yaml", ".yml",
];
const ARTIFACT_RULE: files::ExtensionRule = files::ExtensionRule {
    allowed: &ALLOWED_ARTIFACT_EXTENSIONS,
    noun: "Artifact file",
};
const VENDOR_RULE: files::ExtensionRule = files::ExtensionRule {
    allowed: &ALLOWED_VENDOR_EXTENSIONS,
    noun: "Vendor file",
};

/// Runs the repo structure policy checks.
pub(crate) fn check(repo_root: &Path) -> Result<()> {
    let metadata = rust::load_metadata(repo_root)?;
    let failures = collect_failures(repo_root, &metadata)?;
    if !failures.is_empty() {
        return Err(Error::policy(failures));
    }

    Ok(())
}

fn collect_failures(repo_root: &Path, metadata: &rust::Metadata) -> Result<Vec<String>> {
    let mut failures = Vec::new();
    check_top_level(repo_root, &mut failures)?;
    files::assert_exact_children(
        &repo_root.join("apps"),
        &APPROVED_APPS,
        "apps/",
        &mut failures,
    )?;
    files::assert_exact_children(
        &repo_root.join("packages"),
        &APPROVED_PACKAGES,
        "packages/",
        &mut failures,
    )?;
    files::assert_exact_children(
        &repo_root.join("artifacts"),
        &APPROVED_ARTIFACT_ROOTS,
        "artifacts/",
        &mut failures,
    )?;
    files::assert_exact_children(
        &repo_root.join("vendor"),
        &APPROVED_VENDOR_ROOTS,
        "vendor/",
        &mut failures,
    )?;
    files::assert_exact_children(
        &repo_root.join("backend/service/crates"),
        &APPROVED_CRATES,
        "backend/service/crates/",
        &mut failures,
    )?;
    files::assert_exact_children(
        &repo_root.join("backend/service/testdata"),
        &APPROVED_TESTDATA_ROOTS,
        "backend/service/testdata/",
        &mut failures,
    )?;
    files::check_extensions(
        &repo_root.join("artifacts"),
        &ARTIFACT_RULE,
        repo_root,
        &mut failures,
    )?;
    files::check_extensions(
        &repo_root.join("vendor"),
        &VENDOR_RULE,
        repo_root,
        &mut failures,
    )?;
    check_js_workspaces(repo_root, &mut failures)?;
    rust::collect_workspace_failures(repo_root, metadata, &mut failures)?;
    Ok(failures)
}

fn check_top_level(repo_root: &Path, failures: &mut Vec<String>) -> Result<()> {
    let top_level = files::visible_directories(repo_root)?
        .into_iter()
        .filter(|directory| !IGNORED_TOP_LEVEL.contains(&directory.as_str()))
        .collect::<Vec<_>>();

    for directory in &top_level {
        if FORBIDDEN_TOP_LEVEL.contains(&directory.as_str()) {
            failures.push(format!(
                "Forbidden top-level directory {directory} is present."
            ));
        }

        if !ALLOWED_TOP_LEVEL.contains(&directory.as_str()) {
            failures.push(format!(
                "Unexpected top-level directory {directory} is present."
            ));
        }
    }

    for directory in ALLOWED_TOP_LEVEL {
        if !top_level.iter().any(|current| current == directory) {
            failures.push(format!(
                "Required top-level directory {directory} is missing."
            ));
        }
    }

    Ok(())
}

fn check_js_workspaces(repo_root: &Path, failures: &mut Vec<String>) -> Result<()> {
    let mut units = Vec::new();
    for app in APPROVED_APPS {
        units.push(js::read_unit(
            repo_root,
            js::Kind::App,
            &format!("apps/{app}"),
        )?);
    }

    for package in APPROVED_PACKAGES {
        units.push(js::read_unit(
            repo_root,
            js::Kind::Package,
            &format!("packages/{package}"),
        )?);
    }

    let indices = units
        .iter()
        .enumerate()
        .map(|(index, unit)| (unit.name.clone(), index))
        .collect::<HashMap<_, _>>();
    js::check_workspace_imports(repo_root, &units, &indices, failures)
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_support;
