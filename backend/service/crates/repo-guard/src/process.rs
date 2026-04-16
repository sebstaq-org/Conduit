//! Process helpers for the repo guard CLI.

use crate::error::{Error, Result};
use std::path::Path;
use std::process::{Command, ExitStatus, Output, Stdio};
use std::time::Instant;

enum RunMode {
    Inherit,
    Quiet,
}

struct RunEvents {
    finish: &'static str,
    start: &'static str,
}

/// Captures a command's standard output and fails if the command exits unsuccessfully.
pub(crate) fn capture(program: &str, args: &[&str], cwd: &Path) -> Result<String> {
    let rendered = render(program, args);
    let started_at = Instant::now();
    log_start("repo_guard.process.capture.start", &rendered);
    let output = run_output(program, args, cwd, &rendered)?;
    log_capture_finish(&rendered, &started_at, &output);
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    Err(Error::command_failed(
        rendered,
        output.status,
        String::from_utf8_lossy(&output.stderr).into_owned(),
    ))
}

/// Runs a command with inherited standard I/O.
pub(crate) fn run_inherit(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    run_with_mode(
        program,
        args,
        cwd,
        RunMode::Inherit,
        RunEvents {
            finish: "repo_guard.process.run_inherit.finish",
            start: "repo_guard.process.run_inherit.start",
        },
    )
}

/// Runs a command quietly.
pub(crate) fn run_quiet(program: &str, args: &[&str], cwd: &Path) -> Result<()> {
    run_with_mode(
        program,
        args,
        cwd,
        RunMode::Quiet,
        RunEvents {
            finish: "repo_guard.process.run_quiet.finish",
            start: "repo_guard.process.run_quiet.start",
        },
    )
}

fn run_with_mode(
    program: &str,
    args: &[&str],
    cwd: &Path,
    mode: RunMode,
    events: RunEvents,
) -> Result<()> {
    let rendered = render(program, args);
    let started_at = Instant::now();
    log_start(events.start, &rendered);
    let status = run_status(program, args, cwd, &rendered, mode)?;
    log_status_finish(events.finish, &rendered, &started_at, status.success());
    if status.success() {
        return Ok(());
    }
    Err(Error::command_failed(rendered, status, String::new()))
}

fn run_output(program: &str, args: &[&str], cwd: &Path, rendered: &str) -> Result<Output> {
    command_with_cwd(program, args, cwd)
        .output()
        .map_err(|source| Error::command_io(rendered.to_owned(), source))
}

fn run_status(
    program: &str,
    args: &[&str],
    cwd: &Path,
    rendered: &str,
    mode: RunMode,
) -> Result<ExitStatus> {
    let mut command = command_with_cwd(program, args, cwd);
    if let RunMode::Quiet = mode {
        command.stdout(Stdio::null());
    }
    command
        .status()
        .map_err(|source| Error::command_io(rendered.to_owned(), source))
}

fn command_with_cwd(program: &str, args: &[&str], cwd: &Path) -> Command {
    let mut command = Command::new(program);
    command.args(args).current_dir(cwd);
    command
}

fn log_start(event_name: &str, rendered: &str) {
    tracing::debug!(
        event_name,
        source = "repo-guard",
        command = %rendered
    );
}

fn log_capture_finish(rendered: &str, started_at: &Instant, output: &Output) {
    if output.status.success() {
        log_capture_success(rendered, started_at);
        return;
    }
    log_capture_failure(rendered, started_at, output);
}

fn log_capture_success(rendered: &str, started_at: &Instant) {
    tracing::debug!(
        event_name = "repo_guard.process.capture.finish",
        source = "repo-guard",
        command = %rendered,
        ok = true,
        duration_ms = started_at.elapsed().as_millis()
    );
}

fn log_capture_failure(rendered: &str, started_at: &Instant, output: &Output) {
    let stderr = String::from_utf8_lossy(&output.stderr);
    tracing::warn!(
        event_name = "repo_guard.process.capture.finish",
        source = "repo-guard",
        command = %rendered,
        ok = false,
        duration_ms = started_at.elapsed().as_millis(),
        stderr = %stderr
    );
}

fn log_status_finish(event_name: &str, rendered: &str, started_at: &Instant, ok: bool) {
    if ok {
        log_status_success(event_name, rendered, started_at);
        return;
    }
    log_status_failure(event_name, rendered, started_at);
}

fn log_status_success(event_name: &str, rendered: &str, started_at: &Instant) {
    tracing::debug!(
        event_name,
        source = "repo-guard",
        command = %rendered,
        ok = true,
        duration_ms = started_at.elapsed().as_millis()
    );
}

fn log_status_failure(event_name: &str, rendered: &str, started_at: &Instant) {
    tracing::warn!(
        event_name,
        source = "repo-guard",
        command = %rendered,
        ok = false,
        duration_ms = started_at.elapsed().as_millis()
    );
}

fn render(program: &str, args: &[&str]) -> String {
    if args.is_empty() {
        return program.to_owned();
    }

    format!("{program} {}", args.join(" "))
}
