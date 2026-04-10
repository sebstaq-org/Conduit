//! App-facing service boundary policy for the Conduit bootstrap.

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

use acp_contracts::LOCKED_ACP_METHODS;
use acp_core::{PhaseBoundary, live_state_policy};

/// The app-visible bootstrap description exposed before runtime implementation exists.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppApiBootstrapSurface {
    /// The Conduit phase that this surface describes.
    pub phase: &'static str,
    /// The current runtime-boundary policy description.
    pub policy: &'static str,
    /// The rule for live state ownership.
    pub live_state_policy: &'static str,
    /// The ACP method subset reserved by policy.
    pub locked_methods: &'static [&'static str],
}

/// Builds the app-facing bootstrap surface for diagnostics and proof tooling.
#[must_use]
pub fn bootstrap_surface() -> AppApiBootstrapSurface {
    AppApiBootstrapSurface {
        phase: "0.5",
        policy: PhaseBoundary::BootstrapOnly.description(),
        live_state_policy: live_state_policy(),
        locked_methods: &LOCKED_ACP_METHODS,
    }
}

#[cfg(test)]
mod tests {
    use super::bootstrap_surface;

    #[test]
    fn bootstrap_surface_exposes_locked_subset() {
        let surface = bootstrap_surface();
        assert_eq!(surface.phase, "0.5");
        assert_eq!(surface.locked_methods.len(), 6);
    }
}
