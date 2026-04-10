#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderBootstrapDescriptor {
    pub provider: &'static str,
    pub launcher: &'static str,
    pub phase_status: &'static str,
}

#[must_use]
pub const fn descriptor() -> ProviderBootstrapDescriptor {
    ProviderBootstrapDescriptor {
        provider: "copilot",
        launcher: "copilot --acp --allow-all --no-color --no-auto-update",
        phase_status: "bootstrap-only",
    }
}

#[cfg(test)]
mod tests {
    use super::descriptor;

    #[test]
    fn descriptor_uses_official_launcher() {
        assert!(descriptor().launcher.contains("--acp"));
    }
}
