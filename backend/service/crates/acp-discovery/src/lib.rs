//! Provider launcher provenance and discovery policy for Conduit.

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

/// Describes the official launcher command and auth source for a provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderLauncher {
    /// The normalized provider identifier.
    pub provider: &'static str,
    /// The exact launcher command that is allowed for this provider.
    pub command: &'static str,
    /// The expected source of adapter authentication state.
    pub auth_source: &'static str,
}

/// The fixed launcher catalog allowed by Conduit policy.
pub const PROVIDER_LAUNCHERS: [ProviderLauncher; 3] = [
    ProviderLauncher {
        provider: "claude",
        command: "claude-agent-acp",
        auth_source: "local-login-state",
    },
    ProviderLauncher {
        provider: "codex",
        command: "codex-acp",
        auth_source: "local-login-state",
    },
    ProviderLauncher {
        provider: "copilot",
        command: "copilot --acp --allow-all --no-color --no-auto-update",
        auth_source: "local-login-state",
    },
];

/// Returns the registered launcher descriptor for a provider, if any.
#[must_use]
pub fn launcher(provider: &str) -> Option<ProviderLauncher> {
    PROVIDER_LAUNCHERS
        .iter()
        .copied()
        .find(|entry| entry.provider == provider)
}

#[cfg(test)]
mod tests {
    use super::{PROVIDER_LAUNCHERS, launcher};

    #[test]
    fn known_launchers_are_registered() {
        assert_eq!(PROVIDER_LAUNCHERS.len(), 3);
        assert!(launcher("claude").is_some());
    }
}
