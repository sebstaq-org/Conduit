#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

use acp_contracts::LOCKED_ACP_METHODS;
use acp_core::{PhaseBoundary, live_state_policy};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppApiBootstrapSurface {
    pub phase: &'static str,
    pub policy: &'static str,
    pub live_state_policy: &'static str,
    pub locked_methods: &'static [&'static str],
}

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
