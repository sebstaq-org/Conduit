//! Consumer runtime API boundary for Conduit session commands.

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

mod app_service;
mod command;
mod error;
mod manager;
mod port;

pub use app_service::AppServiceFactory;
pub use command::{ConsumerCommand, ConsumerError, ConsumerResponse};
pub use error::{Result, RuntimeError};
pub use manager::ServiceRuntime;
pub use port::{ProviderFactory, ProviderPort};

#[cfg(test)]
mod tests;
