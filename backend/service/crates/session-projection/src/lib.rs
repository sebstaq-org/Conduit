//! Canonical session transcript projection for Conduit.

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

mod prompt_turn;
mod transcript;

pub use prompt_turn::prompt_turn_items;
pub use transcript::{
    MessageRole, TranscriptItem, TranscriptItemStatus, project_items, project_prompt_turn_items,
};
