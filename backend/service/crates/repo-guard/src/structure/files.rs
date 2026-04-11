//! File-system helpers for repo structure checks.

use crate::error::{Error, Result};
use std::fs::read_dir;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Extension policy for a subtree.
pub(super) struct ExtensionRule {
    /// Allowed extensions including the leading dot.
    pub(super) allowed: &'static [&'static str],
    /// The noun used in the failure text.
    pub(super) noun: &'static str,
}

/// Returns visible child directories for a directory path.
pub(super) fn visible_directories(path: &Path) -> Result<Vec<String>> {
    let mut directories = Vec::new();
    for entry in read_dir(path).map_err(|source| Error::io(Some(path.to_path_buf()), source))? {
        let entry = entry.map_err(|source| Error::io(Some(path.to_path_buf()), source))?;
        let file_type = entry
            .file_type()
            .map_err(|source| Error::io(Some(entry.path()), source))?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if file_type.is_dir() && !name.starts_with('.') {
            directories.push(name.into_owned());
        }
    }

    directories.sort();
    Ok(directories)
}

/// Enforces an exact set of child directories for a root.
pub(super) fn assert_exact_children(
    root: &Path,
    expected: &[&str],
    label: &str,
    failures: &mut Vec<String>,
) -> Result<()> {
    let actual = visible_directories(root)?;

    for directory in &actual {
        if !expected.contains(&directory.as_str()) {
            failures.push(format!(
                "{label} contains unexpected directory {directory}."
            ));
        }
    }

    for directory in expected {
        if !actual.iter().any(|current| current == directory) {
            failures.push(format!(
                "{label} is missing required directory {directory}."
            ));
        }
    }

    Ok(())
}

/// Walks files below a root, excluding build output directories.
pub(super) fn walk_files(root: &Path) -> Result<Vec<PathBuf>> {
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(root).into_iter().filter_entry(|entry| {
        let name = entry.file_name().to_string_lossy();
        !matches!(
            name.as_ref(),
            ".expo" | ".expo-shared" | "dist" | "node_modules" | "out" | "target" | "web-build"
        )
    }) {
        let entry = entry
            .map_err(|source| Error::io(Some(root.to_path_buf()), std::io::Error::other(source)))?;
        if entry.file_type().is_file() {
            files.push(entry.into_path());
        }
    }

    Ok(files)
}

/// Converts a path to a portable repo-relative string when possible.
pub(super) fn relative_path(root: &Path, path: &Path) -> String {
    match path.strip_prefix(root) {
        Ok(relative) => relative.to_string_lossy().replace('\\', "/"),
        Err(_) => path.to_string_lossy().replace('\\', "/"),
    }
}

/// Checks allowed file extensions for a subtree.
pub(super) fn check_extensions(
    root: &Path,
    rule: &ExtensionRule,
    repo_root: &Path,
    failures: &mut Vec<String>,
) -> Result<()> {
    for file in walk_files(root)? {
        if !allowed_extension(&file, rule.allowed) {
            failures.push(format!(
                "{} {} uses a disallowed extension.",
                rule.noun,
                relative_path(repo_root, &file)
            ));
        }
    }

    Ok(())
}

fn allowed_extension(path: &Path, allowed_extensions: &[&str]) -> bool {
    match path.file_name().and_then(std::ffi::OsStr::to_str) {
        Some(".gitkeep") => allowed_extensions.contains(&".gitkeep"),
        _ => path.extension().and_then(std::ffi::OsStr::to_str).map_or(
            allowed_extensions.contains(&""),
            |extension| {
                let dotted = format!(".{extension}");
                allowed_extensions.contains(&dotted.as_str())
            },
        ),
    }
}
