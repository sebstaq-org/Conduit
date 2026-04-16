//! Source-file policy checks for Rust crates.

use super::files::{relative_path, walk_files};
use super::rust::Package;
use super::source_ast;
use crate::error::{Error, Result};
use std::fs::read_to_string;
use std::path::{Path, PathBuf};

const BANNED_LIB_DEPS: [&str; 2] = ["anyhow", "eyre"];
const BANNED_LOGGING_DEPS: [&str; 8] = [
    "env_logger",
    "fern",
    "flexi_logger",
    "log",
    "pretty_env_logger",
    "simplelog",
    "slog",
    "slog-async",
];
const SOURCE_LINE_LIMIT: usize = 700;
const TEST_LINE_LIMIT: usize = 700;

/// Collects Rust source failures for one workspace package.
pub(super) fn collect_failures(
    repo_root: &Path,
    package: &Package,
    failures: &mut Vec<String>,
) -> Result<()> {
    let manifest_dir = package
        .manifest_path
        .parent()
        .unwrap_or(repo_root)
        .to_path_buf();
    let crate_name = manifest_dir
        .file_name()
        .and_then(std::ffi::OsStr::to_str)
        .unwrap_or_default()
        .to_owned();
    let manifest = read_to_string(&package.manifest_path)
        .map_err(|source| Error::io(Some(package.manifest_path.clone()), source))?;
    let manifest_value: toml::Value = toml::from_str(&manifest).map_err(|source| Error::Toml {
        path: package.manifest_path.clone(),
        source,
    })?;

    require_workspace_fields(&crate_name, &manifest_value, failures);
    check_library_dependencies(&crate_name, &manifest_dir, package, failures);
    check_logging_dependencies(&crate_name, package, failures);
    check_crate_root(repo_root, &crate_name, &manifest_dir, failures)?;
    check_rust_files(repo_root, &manifest_dir, failures)
}

fn require_workspace_fields(crate_name: &str, manifest: &toml::Value, failures: &mut Vec<String>) {
    for (path, field) in [
        (
            &["package", "edition", "workspace"][..],
            "edition.workspace = true",
        ),
        (
            &["package", "rust-version", "workspace"][..],
            "rust-version.workspace = true",
        ),
        (&["lints", "workspace"][..], "[lints] workspace = true"),
    ] {
        if !workspace_bool(manifest, path) {
            failures.push(format!("{crate_name} must set {field}."));
        }
    }
}

fn check_library_dependencies(
    crate_name: &str,
    manifest_dir: &Path,
    package: &Package,
    failures: &mut Vec<String>,
) {
    if !manifest_dir.join("src/lib.rs").exists() {
        return;
    }

    for dependency in &package.dependencies {
        if BANNED_LIB_DEPS.contains(&dependency.name.as_str()) {
            failures.push(format!(
                "{crate_name} may not depend on {}; library crates must expose concrete error types.",
                dependency.name
            ));
        }
    }
}

fn check_logging_dependencies(crate_name: &str, package: &Package, failures: &mut Vec<String>) {
    for dependency in &package.dependencies {
        if BANNED_LOGGING_DEPS.contains(&dependency.name.as_str()) {
            failures.push(format!(
                "{crate_name} may not depend on {}; Rust logging must use tracing.",
                dependency.name
            ));
        }
    }

    if !matches!(crate_name, "service-bin" | "repo-guard") {
        return;
    }
    let has_tracing = package
        .dependencies
        .iter()
        .any(|dependency| dependency.name == "tracing");
    let has_tracing_subscriber = package
        .dependencies
        .iter()
        .any(|dependency| dependency.name == "tracing-subscriber");

    if !has_tracing {
        failures.push(format!(
            "{crate_name} must depend on tracing for runtime logging."
        ));
    }
    if !has_tracing_subscriber {
        failures.push(format!(
            "{crate_name} must depend on tracing-subscriber for runtime logging."
        ));
    }
}

fn check_crate_root(
    repo_root: &Path,
    crate_name: &str,
    manifest_dir: &Path,
    failures: &mut Vec<String>,
) -> Result<()> {
    let Some(crate_root) = source_root(manifest_dir) else {
        failures.push(format!("{crate_name} must have src/lib.rs or src/main.rs."));
        return Ok(());
    };
    let crate_root_source = read_to_string(&crate_root)
        .map_err(|source| Error::io(Some(crate_root.clone()), source))?;
    if !has_crate_docs(&crate_root_source) {
        failures.push(format!(
            "{crate_name} must declare crate-level docs with //! in {}.",
            relative_path(repo_root, &crate_root)
        ));
    }

    Ok(())
}

fn check_rust_files(
    repo_root: &Path,
    manifest_dir: &Path,
    failures: &mut Vec<String>,
) -> Result<()> {
    for file in rust_files(manifest_dir)? {
        let source = read_to_string(&file).map_err(|error| Error::io(Some(file.clone()), error))?;
        check_source_file(repo_root, &file, &source, failures)?;
    }

    Ok(())
}

fn rust_files(manifest_dir: &Path) -> Result<Vec<PathBuf>> {
    Ok(walk_files(manifest_dir)?
        .into_iter()
        .filter(|path| path.extension().and_then(std::ffi::OsStr::to_str) == Some("rs"))
        .collect())
}

fn check_source_file(
    repo_root: &Path,
    file: &Path,
    source: &str,
    failures: &mut Vec<String>,
) -> Result<()> {
    let relative = relative_path(repo_root, file);
    let syntax = syn::parse_file(source).map_err(|source_error| {
        Error::invalid_args(&format!(
            "{relative} could not be parsed as Rust source: {source_error}"
        ))
    })?;
    source_ast::check_ast(&relative, &syntax, failures);
    check_line_limits(&relative, source.lines().count(), failures);
    Ok(())
}

fn check_line_limits(relative: &str, line_count: usize, failures: &mut Vec<String>) {
    if relative.contains("/tests/") && line_count > TEST_LINE_LIMIT {
        failures.push(format!(
            "{relative} exceeds the {TEST_LINE_LIMIT} line test-file limit."
        ));
    }
    if relative.contains("/src/") && line_count > SOURCE_LINE_LIMIT {
        failures.push(format!(
            "{relative} exceeds the {SOURCE_LINE_LIMIT} line source-file limit."
        ));
    }
}

fn source_root(manifest_dir: &Path) -> Option<PathBuf> {
    for candidate in ["src/lib.rs", "src/main.rs"] {
        let path = manifest_dir.join(candidate);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

fn has_crate_docs(source: &str) -> bool {
    source
        .lines()
        .any(|line| line.trim_start().starts_with("//!"))
}

fn workspace_bool(value: &toml::Value, path: &[&str]) -> bool {
    let mut current = value;
    for segment in path {
        let Some(next) = current.get(*segment) else {
            return false;
        };
        current = next;
    }

    current.as_bool().unwrap_or(false)
}
