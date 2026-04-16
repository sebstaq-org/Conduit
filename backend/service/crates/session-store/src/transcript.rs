//! Transcript projection primitives for Conduit history windows.

use acp_core::TranscriptUpdateSnapshot;
use agent_client_protocol_schema::ContentBlock;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{Error, Result};

/// One projected transcript item for UI consumption.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum TranscriptItem {
    /// User or agent ACP content.
    Message {
        /// Stable item id within the loaded transcript.
        id: String,
        /// Prompt turn id when the item belongs to a live prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        turn_id: Option<String>,
        /// Live prompt item status when the item is part of a prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<TranscriptItemStatus>,
        /// ACP stop reason for the completed turn, when known.
        #[serde(skip_serializing_if = "Option::is_none")]
        stop_reason: Option<String>,
        /// Message author role.
        role: MessageRole,
        /// ACP content blocks in transcript order.
        content: Vec<ContentBlock>,
    },
    /// Non-message ACP update represented as a collapsed event.
    Event {
        /// Stable item id within the loaded transcript.
        id: String,
        /// Prompt turn id when the item belongs to a live prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        turn_id: Option<String>,
        /// Live prompt item status when the item is part of a prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<TranscriptItemStatus>,
        /// ACP stop reason for the completed turn, when known.
        #[serde(skip_serializing_if = "Option::is_none")]
        stop_reason: Option<String>,
        /// Official ACP update variant.
        variant: String,
        /// Structured ACP update payload.
        data: Value,
    },
}

/// Status for prompt-turn transcript items.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum MessageRole {
    /// User-authored text.
    User,
    /// Agent-authored text.
    Agent,
}

/// Projects provider transcript updates into UI transcript items.
pub(crate) fn project_items(updates: &[TranscriptUpdateSnapshot]) -> Result<Vec<TranscriptItem>> {
    let mut updates = updates.to_vec();
    updates.sort_by_key(|update| update.index);
    let mut items = Vec::new();
    for update in updates {
        match text_role(&update)? {
            Some((role, content)) => {
                append_content_item(&mut items, update.index, role, content);
            }
            None => items.push(TranscriptItem::Event {
                id: format!("transcript-update-{}", update.index),
                turn_id: None,
                status: None,
                stop_reason: None,
                variant: update.variant.clone(),
                data: update.update.clone(),
            }),
        }
    }
    Ok(items)
}

/// Projects live prompt-turn updates into UI transcript items.
pub(crate) fn project_prompt_turn_items(
    turn_id: &str,
    updates: &[TranscriptUpdateSnapshot],
    status: TranscriptItemStatus,
    stop_reason: Option<&str>,
) -> Result<Vec<TranscriptItem>> {
    let mut updates = updates.to_vec();
    updates.sort_by_key(|update| update.index);
    let mut items = Vec::new();
    for update in updates {
        match text_role(&update)? {
            Some((role, content)) => {
                append_prompt_content_item(
                    &mut items,
                    PromptContentItem {
                        turn_id,
                        role,
                        content,
                        update: &update,
                        status,
                        stop_reason,
                    },
                );
            }
            None => items.push(TranscriptItem::Event {
                id: format!("{turn_id}-update-{}", update.index),
                turn_id: Some(turn_id.to_owned()),
                status: Some(status),
                stop_reason: stop_reason.map(ToOwned::to_owned),
                variant: update.variant.clone(),
                data: update.update.clone(),
            }),
        }
    }
    Ok(items)
}

fn append_content_item(
    items: &mut Vec<TranscriptItem>,
    index: usize,
    role: MessageRole,
    content: ContentBlock,
) {
    if let Some(TranscriptItem::Message {
        role: existing_role,
        content: existing_content,
        ..
    }) = items.last_mut()
        && *existing_role == role
    {
        existing_content.push(content);
        return;
    }
    items.push(TranscriptItem::Message {
        id: format!("transcript-update-{index}"),
        turn_id: None,
        status: None,
        stop_reason: None,
        role,
        content: vec![content],
    });
}

struct PromptContentItem<'a> {
    turn_id: &'a str,
    role: MessageRole,
    content: ContentBlock,
    update: &'a TranscriptUpdateSnapshot,
    status: TranscriptItemStatus,
    stop_reason: Option<&'a str>,
}

fn append_prompt_content_item(items: &mut Vec<TranscriptItem>, input: PromptContentItem<'_>) {
    if let Some(TranscriptItem::Message {
        role: existing_role,
        content,
        stop_reason,
        ..
    }) = items.last_mut()
        && *existing_role == input.role
    {
        content.push(input.content);
        *stop_reason = input.stop_reason.map(ToOwned::to_owned);
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
        stop_reason: input.stop_reason.map(ToOwned::to_owned),
        role: input.role,
        content: vec![input.content],
    });
}

fn text_role(update: &TranscriptUpdateSnapshot) -> Result<Option<(MessageRole, ContentBlock)>> {
    let role = match update.variant.as_str() {
        "user_message_chunk" => MessageRole::User,
        "agent_message_chunk" => MessageRole::Agent,
        _ => return Ok(None),
    };
    let Some(content) = update.update.get("content") else {
        return Err(Error::ContractViolation {
            message: format!("{} update is missing ACP content", update.variant),
        });
    };
    let content = serde_json::from_value::<ContentBlock>(content.clone()).map_err(|error| {
        Error::ContractViolation {
            message: format!(
                "{} update content does not match ACP ContentBlock: {error}",
                update.variant
            ),
        }
    })?;
    Ok(Some((role, content)))
}
