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
mod toolchain;

use crate::error::{Error, Result};
use std::env;
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
    let repo_root = repo_root()?;
    match parse_command(env::args().skip(1))? {
        CommandKind::Bootstrap => bootstrap::run(&repo_root),
        CommandKind::Clean => clean::run(&repo_root),
        CommandKind::StructureCheck => structure::check(&repo_root),
        CommandKind::ToolchainCheck => toolchain::check(&repo_root),
    }
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
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let Some(repo_root) = manifest_dir.ancestors().nth(4) else {
        return Err(Error::invalid_args("failed to resolve the repository root"));
    };

    Ok(repo_root.to_path_buf())
}
