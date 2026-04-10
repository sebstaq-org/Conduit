//! Binary composition root for the Conduit service workspace.

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

use acp_discovery::PROVIDER_LAUNCHERS;
use app_api::bootstrap_surface;
use provider_claude::descriptor as claude_descriptor;
use provider_codex::descriptor as codex_descriptor;
use provider_copilot::descriptor as copilot_descriptor;
use session_store::bootstrap_store_boundary;

/// Resolves the bootstrap composition graph for the service workspace.
fn main() {
    let _surface = bootstrap_surface();
    let _claude = claude_descriptor();
    let _codex = codex_descriptor();
    let _copilot = copilot_descriptor();
    let _launcher_count = PROVIDER_LAUNCHERS.len();
    let _store_boundary = bootstrap_store_boundary();
}
