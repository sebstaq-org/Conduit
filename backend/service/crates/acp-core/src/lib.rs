//! Core ACP runtime boundary policy for the Conduit service workspace.

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

/// Declares which runtime boundary state is currently implemented in this crate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhaseBoundary {
    /// The crate only reserves the eventual ACP runtime boundary.
    BootstrapOnly,
}

impl PhaseBoundary {
    /// Returns the current boundary description for crate consumers and diagnostics.
    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::BootstrapOnly => {
                "ACP host and provider runtime are intentionally deferred to Phase 1."
            }
        }
    }
}

/// Returns the live-state ownership rule that Conduit will preserve across phases.
#[must_use]
pub const fn live_state_policy() -> &'static str {
    "process-local-in-memory"
}

#[cfg(test)]
mod tests {
    use super::{PhaseBoundary, live_state_policy};

    #[test]
    fn phase_boundary_stays_bootstrap_only() {
        assert_eq!(live_state_policy(), "process-local-in-memory");
        assert!(
            PhaseBoundary::BootstrapOnly
                .description()
                .contains("Phase 1")
        );
    }
}
