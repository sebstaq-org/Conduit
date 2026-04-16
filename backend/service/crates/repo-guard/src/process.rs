//! Process helpers for the repo guard CLI.

use crate::error::{Error, Result};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Instant;

/// Captures a command's standard output and fails if the command exits unsuccessfully.
pub(crate) fn capture(program: &str, args: &[&str], cwd: &Path) -> Result<String> {
    let rendered = render(program, args);
    let started_at = Instant::now();
    tracing::debug!(
        event_name = "repo_guard.process.capture.start",
        source = "repo-guard",
        command = %rendered
    );
    let output = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|source| Error::command_io(rendered.clone(), source))?;

    if !output.status.success() {
        tracing::warn!(
            event_name = "repo_guard.process.capture.finish",
            source = "repo-guard",
            command = %rendered,
            ok = false,
            duration_ms = started_at.elapsed().as_millis(),
            stderr = %String::from_utf8_lossy(&output.stderr)
        );
        return Err(Error::command_failed(
            rendered,
            output.status,
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }

    tracing::debug!(
        event_name = "repo_guard.process.capture.finish",
        source = "repo-guard",
        command = %rendered,
        ok = true,
        duration_ms = started_at.elapsed().as_millis()
    );
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Runs a command with inherited standard I/O.
pub(crate) fn run_inherit(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    let rendered = render(program, args);
    let started_at = Instant::now();
    tracing::debug!(
        event_name = "repo_guard.process.run_inherit.start",
        source = "repo-guard",
        command = %rendered
    );
    let status = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .status()
        .map_err(|source| Error::command_io(rendered.clone(), source))?;

    if status.success() {
        tracing::debug!(
            event_name = "repo_guard.process.run_inherit.finish",
            source = "repo-guard",
            command = %rendered,
            ok = true,
            duration_ms = started_at.elapsed().as_millis()
        );
        return Ok(());
    }

    tracing::warn!(
        event_name = "repo_guard.process.run_inherit.finish",
        source = "repo-guard",
        command = %rendered,
        ok = false,
        duration_ms = started_at.elapsed().as_millis()
    );
    Err(Error::command_failed(rendered, status, String::new()))
}

/// Runs a command quietly.
pub(crate) fn run_quiet(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    let rendered = render(program, args);
    let started_at = Instant::now();
    tracing::debug!(
        event_name = "repo_guard.process.run_quiet.start",
        source = "repo-guard",
        command = %rendered
    );
    let status = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::null())
        .status()
        .map_err(|source| Error::command_io(rendered.clone(), source))?;

    if status.success() {
        tracing::debug!(
            event_name = "repo_guard.process.run_quiet.finish",
            source = "repo-guard",
            command = %rendered,
            ok = true,
            duration_ms = started_at.elapsed().as_millis()
        );
        return Ok(());
    }

    tracing::warn!(
        event_name = "repo_guard.process.run_quiet.finish",
        source = "repo-guard",
        command = %rendered,
        ok = false,
        duration_ms = started_at.elapsed().as_millis()
    );
    Err(Error::command_failed(rendered, status, String::new()))
}
fn render(program: &str, args: &[&str]) -> String {
    if args.is_empty() {
        return program.to_owned();
    }

    format!("{program} {}", args.join(" "))
}
