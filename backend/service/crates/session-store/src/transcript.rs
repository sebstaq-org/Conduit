//! Transcript projection primitives for Conduit history windows.

use acp_core::TranscriptUpdateSnapshot;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One projected transcript item for UI consumption.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum TranscriptItem {
    /// User or agent text assembled from ACP text chunk updates.
    Message {
        /// Stable item id within the loaded transcript.
        id: String,
        /// Prompt turn id when the item belongs to a live prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        turn_id: Option<String>,
        /// Live prompt item status when the item is part of a prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<TranscriptItemStatus>,
        /// Message author role.
        role: MessageRole,
        /// Text content.
        text: String,
        /// ACP update variants that contributed to this item.
        source_variants: Vec<String>,
    },
    /// Non-message ACP update represented as a collapsed event.
    Event {
        /// Stable item id within the loaded transcript.
        id: String,
        /// Official ACP update variant.
        variant: String,
        /// Human-readable event title.
        title: String,
        /// Whether UI should collapse this event by default.
        default_collapsed: bool,
    },
}

/// Status for prompt-turn transcript items.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptItemStatus {
    /// The item is complete.
    Complete,
    /// The item is still streaming.
    Streaming,
    /// The item was cancelled before normal completion.
    Cancelled,
    /// The item failed before normal completion.
    Failed,
}

/// Author role for projected transcript messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    /// User-authored text.
    User,
    /// Agent-authored text.
    Agent,
}

/// Projects provider transcript updates into UI transcript items.
pub(crate) fn project_items(updates: &[TranscriptUpdateSnapshot]) -> Vec<TranscriptItem> {
    let mut updates = updates.to_vec();
    updates.sort_by_key(|update| update.index);
    let mut items = Vec::new();
    for update in updates {
        match text_role(&update) {
            Some((role, text)) => append_text_item(&mut items, update.index, role, text, &update),
            None => items.push(TranscriptItem::Event {
                id: format!("transcript-update-{}", update.index),
                variant: update.variant.clone(),
                title: event_title(&update),
                default_collapsed: true,
            }),
        }
    }
    items
}

/// Projects live prompt-turn updates into UI transcript items.
pub(crate) fn project_prompt_turn_items(
    turn_id: &str,
    updates: &[TranscriptUpdateSnapshot],
    status: TranscriptItemStatus,
) -> Vec<TranscriptItem> {
    let mut updates = updates.to_vec();
    updates.sort_by_key(|update| update.index);
    let mut items = Vec::new();
    for update in updates {
        match text_role(&update) {
            Some((role, text)) => {
                append_prompt_text_item(
                    &mut items,
                    PromptTextItem {
                        turn_id,
                        role,
                        text,
                        update: &update,
                        status,
                    },
                );
            }
            None => items.push(TranscriptItem::Event {
                id: format!("{turn_id}-update-{}", update.index),
                variant: update.variant.clone(),
                title: event_title(&update),
                default_collapsed: true,
            }),
        }
    }
    items
}

fn append_text_item(
    items: &mut Vec<TranscriptItem>,
    index: usize,
    role: MessageRole,
    text: String,
    update: &TranscriptUpdateSnapshot,
) {
    if let Some(TranscriptItem::Message {
        role: existing_role,
        text: existing_text,
        source_variants,
        ..
    }) = items.last_mut()
        && *existing_role == role
    {
        existing_text.push_str(&text);
        source_variants.push(update.variant.clone());
        return;
    }
    items.push(TranscriptItem::Message {
        id: format!("transcript-update-{index}"),
        turn_id: None,
        status: None,
        role,
        text,
        source_variants: vec![update.variant.clone()],
    });
}

struct PromptTextItem<'a> {
    turn_id: &'a str,
    role: MessageRole,
    text: String,
    update: &'a TranscriptUpdateSnapshot,
    status: TranscriptItemStatus,
}

fn append_prompt_text_item(items: &mut Vec<TranscriptItem>, input: PromptTextItem<'_>) {
    if let Some(TranscriptItem::Message {
        role: existing_role,
        text: existing_text,
        source_variants,
        ..
    }) = items.last_mut()
        && *existing_role == input.role
    {
        existing_text.push_str(&input.text);
        source_variants.push(input.update.variant.clone());
        return;
    }
    let status = match input.role {
        MessageRole::User => TranscriptItemStatus::Complete,
        MessageRole::Agent => input.status,
    };
    items.push(TranscriptItem::Message {
        id: format!("{}-update-{}", input.turn_id, input.update.index),
        turn_id: Some(input.turn_id.to_owned()),
        status: Some(status),
        role: input.role,
        text: input.text,
        source_variants: vec![input.update.variant.clone()],
    });
}

fn text_role(update: &TranscriptUpdateSnapshot) -> Option<(MessageRole, String)> {
    let role = match update.variant.as_str() {
        "user_message_chunk" => MessageRole::User,
        "agent_message_chunk" => MessageRole::Agent,
        _ => return None,
    };
    let text = update
        .update
        .get("content")
        .and_then(|content| content.get("text"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    Some((role, text))
}

fn event_title(update: &TranscriptUpdateSnapshot) -> String {
    update
        .update
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or(update.variant.as_str())
        .to_owned()
}
