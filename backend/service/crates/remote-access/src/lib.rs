//! Remote relay routing, offer issuance, and encrypted frame support.

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

mod cipher;
mod offers;
mod route;

pub use cipher::{
    RelayCipherChannel, RelayCipherContext, RelayCipherError, accept_client_handshake,
};
pub use offers::{
    IssuedRelayOffer, IssuedRelayOfferContext, RelayOfferStoreError, issue_relay_offer,
    lookup_relay_offer,
};
pub use route::{
    RelayControlFrame, RelayRouteError, RelayRouting, RelayUrlOptions,
    build_relay_websocket_protocol, build_relay_websocket_url, derive_relay_connection_id,
    derive_relay_server_id, generate_relay_capability, load_or_create_relay_routing,
    parse_relay_control_frame,
};
