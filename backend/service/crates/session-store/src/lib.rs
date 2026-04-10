//! Read-side session-store boundary policy for Conduit.

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

/// The policy boundary for the local session store during bootstrap and Phase 1.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoreBoundary {
    /// The system that owns live runtime truth.
    pub live_truth: &'static str,
    /// The only scope currently allowed for persisted state.
    pub allowed_scope: &'static str,
}

/// Returns the allowed store boundary for the current phase.
#[must_use]
pub const fn bootstrap_store_boundary() -> StoreBoundary {
    StoreBoundary {
        live_truth: "acp-runtime-only",
        allowed_scope: "historical-read-side-only",
    }
}

#[cfg(test)]
mod tests {
    use super::bootstrap_store_boundary;

    #[test]
    fn store_boundary_stays_read_side_only() {
        assert_eq!(
            bootstrap_store_boundary().allowed_scope,
            "historical-read-side-only"
        );
    }
}
