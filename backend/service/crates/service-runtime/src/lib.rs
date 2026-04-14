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
mod event;
mod manager;
mod manager_helpers;
mod manager_response;
mod port;
mod session_browser;
mod session_groups;

#[cfg(test)]
use agent_client_protocol_schema as _;

pub use app_service::AppServiceFactory;
pub use command::{ConsumerCommand, ConsumerError, ConsumerResponse};
pub use error::{Result, RuntimeError};
pub use event::{RuntimeEvent, RuntimeEventKind};
pub use manager::ServiceRuntime;
pub use port::{ProviderFactory, ProviderPort};
