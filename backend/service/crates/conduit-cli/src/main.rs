//! Operator CLI for Conduit capture tooling.

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

mod capture;
mod cli;
mod error;

use crate::capture::run_capture;
use crate::cli::{Command, parse_command};
use crate::error::Result;
use std::env;
use std::io::Write;

fn main() -> Result<()> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    match parse_command(&args)? {
        Command::Capture(request) => {
            let result = run_capture(request)?;
            let mut stdout = std::io::stdout().lock();
            writeln!(stdout, "capture written: {}", result.output.display())?;
        }
    }
    Ok(())
}
