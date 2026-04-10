#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoreBoundary {
    pub live_truth: &'static str,
    pub allowed_scope: &'static str,
}

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
