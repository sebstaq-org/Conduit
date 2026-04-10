//! Process helpers for the repo guard CLI.

use crate::error::{Error, Result};
use std::path::Path;
use std::process::{Command, Stdio};

/// Captures a command's standard output and fails if the command exits unsuccessfully.
pub(crate) fn capture(program: &str, args: &[&str], cwd: &Path) -> Result<String> {
    let rendered = render(program, args);
    let output = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|source| Error::command_io(rendered.clone(), source))?;

    if !output.status.success() {
        return Err(Error::command_failed(
            rendered,
            output.status,
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Runs a command with inherited standard I/O.
pub(crate) fn run_inherit(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    let rendered = render(program, args);
    let status = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .status()
        .map_err(|source| Error::command_io(rendered.clone(), source))?;

    if status.success() {
        return Ok(());
    }

    Err(Error::command_failed(rendered, status, String::new()))
}

/// Runs a command quietly.
pub(crate) fn run_quiet(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    let rendered = render(program, args);
    let status = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::null())
        .status()
        .map_err(|source| Error::command_io(rendered.clone(), source))?;

    if status.success() {
        return Ok(());
    }

    Err(Error::command_failed(rendered, status, String::new()))
}
fn render(program: &str, args: &[&str]) -> String {
    if args.is_empty() {
        return program.to_owned();
    }

    format!("{program} {}", args.join(" "))
}
