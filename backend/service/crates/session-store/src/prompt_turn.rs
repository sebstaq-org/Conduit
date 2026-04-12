//! Prompt-turn projection helpers for stored timelines.

use acp_core::TranscriptUpdateSnapshot;
use serde_json::Value;

use crate::transcript::project_prompt_turn_items;
use crate::transcript::{MessageRole, TranscriptItem, TranscriptItemStatus};

pub(crate) fn prompt_turn_items(
    turn_id: &str,
    prompt: &[Value],
    updates: &[TranscriptUpdateSnapshot],
    status: TranscriptItemStatus,
    stop_reason: Option<&str>,
) -> Vec<TranscriptItem> {
    let mut items = vec![TranscriptItem::Message {
        id: format!("{turn_id}-user"),
        turn_id: Some(turn_id.to_owned()),
        status: Some(TranscriptItemStatus::Complete),
        stop_reason: None,
        role: MessageRole::User,
        content: prompt.to_owned(),
    }];
    let prompt_update_items = project_prompt_turn_items(turn_id, updates, status, stop_reason);
    let has_agent_message = prompt_update_items.iter().any(|item| {
        matches!(
            item,
            TranscriptItem::Message {
                role: MessageRole::Agent,
                ..
            }
        )
    });
    items.extend(prompt_update_items);
    if !has_agent_message
        && matches!(
            status,
            TranscriptItemStatus::Cancelled | TranscriptItemStatus::Failed
        )
    {
        items.push(TranscriptItem::Message {
            id: format!("{turn_id}-terminal"),
            turn_id: Some(turn_id.to_owned()),
            status: Some(status),
            stop_reason: stop_reason.map(ToOwned::to_owned),
            role: MessageRole::Agent,
            content: Vec::new(),
        });
    }
    items
}

pub(crate) fn transcript_item_turn_id(item: &TranscriptItem) -> Option<&str> {
    match item {
        TranscriptItem::Message { turn_id, .. } | TranscriptItem::Event { turn_id, .. } => {
            turn_id.as_deref()
        }
    }
}
