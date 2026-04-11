//! Official ACP launcher discovery and initialize probing for Conduit.

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

mod environment;
mod error;
mod path;
mod probe;
mod provider;

pub use environment::ProcessEnvironment;
pub use error::{DiscoveryError, Result};
pub use probe::{
    DiscoveryCatalog, InitializeProbe, ProviderDiscovery, discover_provider,
    discover_provider_with_environment, resolve_provider_command,
};
pub use provider::{LauncherCommand, ProviderId, ProviderLauncher, provider_launcher};
