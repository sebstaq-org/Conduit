//! Product runtime entrypoint for Conduit.

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

mod cli;
mod error;
mod local_store;
mod runtime;
mod serve;

use crate::cli::parse_command;
use crate::error::Result;
use std::env;
use telemetry_support::TelemetryBinary;
use tracing_subscriber as _;

#[tokio::main]
async fn main() -> Result<()> {
    let telemetry = telemetry_support::init(TelemetryBinary::Backend)?;
    let args = env::args().skip(1).collect::<Vec<_>>();
    tracing::debug!(
        event_name = "service_bin.startup",
        source = "service-bin",
        args = ?args
    );
    let command = parse_command(&args)?;
    match command {
        cli::Command::Serve {
            host,
            port,
            provider_fixtures,
            store_path,
        } => {
            serve::run(
                &host,
                port,
                provider_fixtures,
                store_path,
                telemetry.health(),
            )
            .await
        }
        cli::Command::Runtime { command } => runtime::run(command),
    }
}
