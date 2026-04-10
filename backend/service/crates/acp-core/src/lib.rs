#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhaseBoundary {
    BootstrapOnly,
}

impl PhaseBoundary {
    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::BootstrapOnly => {
                "ACP host and provider runtime are intentionally deferred to Phase 1."
            }
        }
    }
}

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
