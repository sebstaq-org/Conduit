#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderLauncher {
    pub provider: &'static str,
    pub command: &'static str,
    pub auth_source: &'static str,
}

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
