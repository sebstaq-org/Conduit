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
mod home;
mod identity;
mod local_store;
mod runtime;
mod serve;
mod telemetry;

use crate::cli::parse_command;
use crate::error::Result;
use crate::home::product_home;
use crate::identity::pairing_response;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let command = parse_command(&args)?;
    match command {
        cli::Command::Serve {
            host,
            port,
            relay_endpoint,
            app_base_url,
        } => {
            telemetry::init();
            tracing::debug!(
                event_name = "service_bin.startup",
                source = "service-bin",
                args = ?args
            );
            serve::run(&host, port, relay_endpoint, app_base_url).await
        }
        cli::Command::Pair {
            relay_endpoint,
            app_base_url,
        } => {
            let response = pairing_response(&product_home()?, &relay_endpoint, &app_base_url)?;
            runtime::write_json(&response)
        }
        cli::Command::Runtime { command } => runtime::run(command),
    }
}
