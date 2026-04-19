#![forbid(unsafe_code)]
#![deny(
    missing_docs,
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::invalid_codeblock_attributes,
    rustdoc::invalid_rust_codeblocks,
    rustdoc::missing_crate_level_docs,
    rustdoc::private_intra_doc_links
)]

//! Repo guardrails CLI for Conduit.

mod bootstrap;
mod clean;
mod error;
mod process;
mod structure;
mod telemetry;
mod toolchain;

use crate::error::{Error, Result};
use std::env::{self, current_dir};
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CommandKind {
    Bootstrap,
    Clean,
    StructureCheck,
    ToolchainCheck,
}

fn main() -> Result<()> {
    run()
}

fn run() -> Result<()> {
    telemetry::init();
    let repo_root = repo_root()?;
    let command = parse_command(env::args().skip(1))?;
    log_command_start(command);
    let result = execute_command(command, &repo_root);
    log_command_finish(command, &result);
    result
}

fn execute_command(command: CommandKind, repo_root: &Path) -> Result<()> {
    match command {
        CommandKind::Bootstrap => bootstrap::run(repo_root),
        CommandKind::Clean => clean::run(repo_root),
        CommandKind::StructureCheck => structure::check(repo_root),
        CommandKind::ToolchainCheck => toolchain::check(repo_root),
    }
}

fn log_command_start(command: CommandKind) {
    tracing::info!(
        event_name = "repo_guard.command.start",
        source = "repo-guard",
        command = ?command
    );
}

fn log_command_finish(command: CommandKind, result: &Result<()>) {
    if result.is_ok() {
        log_command_success(command);
        return;
    }
    if let Err(error) = result {
        log_command_failure(command, error);
    }
}

fn log_command_success(command: CommandKind) {
    tracing::info!(
        event_name = "repo_guard.command.finish",
        source = "repo-guard",
        command = ?command,
        ok = true
    );
}

fn log_command_failure(command: CommandKind, error: &Error) {
    tracing::error!(
        event_name = "repo_guard.command.finish",
        source = "repo-guard",
        command = ?command,
        ok = false,
        error_message = %error
    );
}

fn parse_command(mut args: impl Iterator<Item = String>) -> Result<CommandKind> {
    let Some(command) = args.next() else {
        return Err(Error::invalid_args(
            "expected one subcommand: bootstrap, clean, structure-check, or toolchain-check",
        ));
    };

    if args.next().is_some() {
        return Err(Error::invalid_args("expected exactly one subcommand"));
    }

    match command.as_str() {
        "bootstrap" => Ok(CommandKind::Bootstrap),
        "clean" => Ok(CommandKind::Clean),
        "structure-check" => Ok(CommandKind::StructureCheck),
        "toolchain-check" => Ok(CommandKind::ToolchainCheck),
        _ => Err(Error::invalid_args(
            "unknown subcommand; expected bootstrap, clean, structure-check, or toolchain-check",
        )),
    }
}

fn repo_root() -> Result<PathBuf> {
    let cwd = current_dir().map_err(|source| Error::io(None, source))?;
    if let Some(repo_root) = discover_repo_root(&cwd) {
        return Ok(repo_root);
    }

    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(repo_root) = discover_repo_root(manifest_dir) else {
        return Err(Error::invalid_args("failed to resolve the repository root"));
    };

    Ok(repo_root)
}

fn discover_repo_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|candidate| {
            candidate.join("package.json").is_file()
                && candidate.join("backend/service/Cargo.toml").is_file()
        })
        .map(Path::to_path_buf)
}
