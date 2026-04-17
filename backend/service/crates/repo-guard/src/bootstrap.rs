//! Bootstrap entrypoint for a fresh machine.

use crate::error::Result;
use crate::process::{run_inherit, run_quiet};
use crate::{structure, toolchain};
use std::fs::{copy, create_dir_all, remove_file};
use std::path::Path;

/// Runs the repo bootstrap flow after verifying hard guardrails.
pub(crate) fn run(repo_root: &Path) -> Result<()> {
    toolchain::check(repo_root)?;
    structure::check(repo_root)?;
    run_inherit("pnpm", &["run", "build"], repo_root)?;
    run_quiet(
        "cargo",
        &[
            "metadata",
            "--locked",
            "--manifest-path",
            "backend/service/Cargo.toml",
            "--format-version",
            "1",
        ],
        repo_root,
    )?;
    run_inherit(
        "cargo",
        &[
            "build",
            "--locked",
            "--manifest-path",
            "backend/service/Cargo.toml",
            "--workspace",
        ],
        repo_root,
    )?;
    install_conduit_cli(repo_root)
}

fn install_conduit_cli(repo_root: &Path) -> Result<()> {
    let source = repo_root.join("backend/service/target/debug/conduit");
    let home = std::env::var("HOME")
        .map_err(|_source| crate::error::Error::invalid_args("HOME is required"))?;
    let bin_dir = Path::new(&home).join(".local/bin");
    let target = bin_dir.join("conduit");
    create_dir_all(&bin_dir).map_err(|source| crate::error::Error::io(Some(bin_dir), source))?;
    if target.exists() || target.is_symlink() {
        remove_file(&target)
            .map_err(|source| crate::error::Error::io(Some(target.clone()), source))?;
    }
    copy(&source, &target).map_err(|source| crate::error::Error::io(Some(target), source))?;
    Ok(())
}
