//! Bootstrap entrypoint for a fresh machine.

use crate::error::Result;
use crate::process::{run_inherit, run_quiet};
use crate::{structure, toolchain};
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
    )
}
