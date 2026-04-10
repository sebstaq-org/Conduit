//! Claude provider boundary policy for Conduit.

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

/// The fixed bootstrap descriptor for the Claude ACP adapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderBootstrapDescriptor {
    /// The normalized provider identifier.
    pub provider: &'static str,
    /// The exact launcher command allowed for this provider.
    pub launcher: &'static str,
    /// The current implementation status of this provider boundary.
    pub phase_status: &'static str,
}

/// Returns the bootstrap descriptor for Claude.
#[must_use]
pub const fn descriptor() -> ProviderBootstrapDescriptor {
    ProviderBootstrapDescriptor {
        provider: "claude",
        launcher: "claude-agent-acp",
        phase_status: "bootstrap-only",
    }
}

#[cfg(test)]
mod tests {
    use super::descriptor;

    #[test]
    fn descriptor_uses_official_launcher() {
        assert_eq!(descriptor().launcher, "claude-agent-acp");
    }
}
