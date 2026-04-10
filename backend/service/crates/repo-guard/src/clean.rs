//! Repo cleaning logic for generated files.

use crate::error::{Error, Result};
use std::fs::{read_dir, remove_dir_all, remove_file};
use std::path::Path;

/// Removes generated build output and artifact contents without touching tracked files.
pub(crate) fn run(repo_root: &Path) -> Result<()> {
    remove_tree(&repo_root.join("backend/service/target"))?;
    clear_artifact_root(&repo_root.join("artifacts/manual"))?;
    clear_artifact_root(&repo_root.join("artifacts/automated"))?;
    clear_workspace_dist(&repo_root.join("apps"))?;
    clear_workspace_dist(&repo_root.join("packages"))?;
    Ok(())
}

fn clear_artifact_root(root: &Path) -> Result<()> {
    if !root.exists() {
        return Ok(());
    }

    for entry in read_dir(root).map_err(|source| Error::io(Some(root.to_path_buf()), source))? {
        let entry = entry.map_err(|source| Error::io(Some(root.to_path_buf()), source))?;
        if entry.file_name() == ".gitkeep" {
            continue;
        }

        let path = entry.path();
        if path.is_dir() {
            remove_tree(&path)?;
        } else if path.exists() {
            remove_file(&path).map_err(|source| Error::io(Some(path), source))?;
        }
    }

    Ok(())
}

fn clear_workspace_dist(root: &Path) -> Result<()> {
    if !root.exists() {
        return Ok(());
    }

    for entry in read_dir(root).map_err(|source| Error::io(Some(root.to_path_buf()), source))? {
        let entry = entry.map_err(|source| Error::io(Some(root.to_path_buf()), source))?;
        if !entry.path().is_dir() {
            continue;
        }

        remove_tree(&entry.path().join("dist"))?;
        remove_tree(&entry.path().join("out"))?;
        remove_tree(&entry.path().join(".expo"))?;
        remove_tree(&entry.path().join(".expo-shared"))?;
        remove_tree(&entry.path().join("web-build"))?;
        remove_leaf(&entry.path().join("tsconfig.tsbuildinfo"))?;
        remove_leaf(&entry.path().join("tsconfig.node.tsbuildinfo"))?;
        remove_leaf(&entry.path().join("tsconfig.web.tsbuildinfo"))?;
    }

    Ok(())
}

fn remove_tree(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }

    remove_dir_all(path).map_err(|source| Error::io(Some(path.to_path_buf()), source))
}

fn remove_leaf(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }

    remove_file(path).map_err(|source| Error::io(Some(path.to_path_buf()), source))
}
