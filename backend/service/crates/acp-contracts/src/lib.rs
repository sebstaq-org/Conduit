#![forbid(unsafe_code)]
#![deny(
    rustdoc::bare_urls,
    rustdoc::broken_intra_doc_links,
    rustdoc::private_intra_doc_links
)]

pub const LOCKED_ACP_METHODS: [&str; 6] = [
    "initialize",
    "session/new",
    "session/list",
    "session/load",
    "session/prompt",
    "session/cancel",
];

#[must_use]
pub const fn vendor_contract_root() -> &'static str {
    "../../../vendor/agent-client-protocol"
}

#[must_use]
pub fn contract_lock_note() -> String {
    format!(
        "Phase 0.5 keeps official ACP as policy only. Phase 1 will pin contracts under {}.",
        vendor_contract_root()
    )
}

#[cfg(test)]
mod tests {
    use super::{LOCKED_ACP_METHODS, contract_lock_note};

    #[test]
    fn locked_subset_is_present() {
        assert_eq!(LOCKED_ACP_METHODS.len(), 6);
        assert!(contract_lock_note().contains("Phase 1"));
    }
}
