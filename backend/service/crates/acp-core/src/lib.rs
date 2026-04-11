//! ACP host ownership for official provider adapters.

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

mod error;
mod host;
mod snapshot;
mod wire;

pub use error::{AcpError, Result};
pub use host::AcpHost;
pub use snapshot::{
    ConnectionState, LiveSessionIdentity, LiveSessionSnapshot, PromptLifecycleSnapshot,
    PromptLifecycleState, ProviderSnapshot,
};
pub use wire::{RawWireEvent, WireKind, WireStream};
