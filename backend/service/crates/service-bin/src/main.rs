//! Silent Phase 1 proof runner for Conduit.

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

mod artifact;
mod cli;
mod error;
mod proof;
mod runtime;
mod scenarios;
mod support;

use crate::cli::parse_command;
use crate::error::Result;
use std::env;

fn main() -> Result<()> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let command = parse_command(&args)?;
    match command {
        cli::Command::Runtime { command } => runtime::run(command),
        proof_command => scenarios::run(proof_command, &args),
    }
}
