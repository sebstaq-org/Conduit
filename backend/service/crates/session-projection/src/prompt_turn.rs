//! Prompt-turn projection helpers for session timelines.

use acp_core::TranscriptUpdateSnapshot;
use serde_json::Value;

use crate::{
    ConduitLocalTranscriptEvent, MessageRole, TranscriptItem, TranscriptItemStatus,
    project_prompt_turn_items,
};

/// Inputs for projecting one prompt turn into user-visible transcript items.
#[derive(Debug, Clone, Copy)]
pub struct PromptTurnInput<'a> {
    /// Stable id shared by all items in this prompt turn.
    pub turn_id: &'a str,
    /// User prompt ACP content blocks.
    pub prompt: &'a [Value],
    /// Provider ACP updates observed during the prompt turn.
    pub updates: &'a [TranscriptUpdateSnapshot],
    /// Conduit-local events attached to this prompt turn.
    pub conduit_events: &'a [ConduitLocalTranscriptEvent],
    /// Current transcript status for prompt-turn items.
    pub status: TranscriptItemStatus,
    /// ACP stop reason returned by the provider, when known.
    pub stop_reason: Option<&'a str>,
}

/// Projects one prompt turn into user-visible transcript items.
pub fn prompt_turn_items(input: PromptTurnInput<'_>) -> Vec<TranscriptItem> {
    let mut items = vec![TranscriptItem::Message {
        id: format!("{}-user", input.turn_id),
        turn_id: Some(input.turn_id.to_owned()),
        status: Some(TranscriptItemStatus::Complete),
        stop_reason: None,
        role: MessageRole::User,
        content: input.prompt.to_owned(),
    }];
    let prompt_update_items = project_prompt_turn_items(
        input.turn_id,
        input.updates,
        input.conduit_events,
        input.status,
        input.stop_reason,
    );
    let has_agent_message = prompt_update_items.iter().any(|item| {
        matches!(
            item,
            TranscriptItem::Message {
                role: MessageRole::Agent,
                ..
            }
        )
    });
    let has_turn_error = prompt_update_items.iter().any(|item| {
        matches!(
            item,
            TranscriptItem::Event { variant, .. } if variant == "turn_error"
        )
    });
    items.extend(prompt_update_items);
    if !has_agent_message
        && !has_turn_error
        && matches!(
            input.status,
            TranscriptItemStatus::Cancelled | TranscriptItemStatus::Failed
        )
    {
        items.push(TranscriptItem::Message {
            id: format!("{}-terminal", input.turn_id),
            turn_id: Some(input.turn_id.to_owned()),
            status: Some(input.status),
            stop_reason: input.stop_reason.map(ToOwned::to_owned),
            role: MessageRole::Agent,
            content: Vec::new(),
        });
    }
    items
}

#[cfg(test)]
mod tests {
    use super::{PromptTurnInput, prompt_turn_items};
    use crate::{
        ConduitLocalTranscriptEvent, MessageRole, TranscriptEventSource, TranscriptItem,
        TranscriptItemStatus,
    };
    use acp_core::TranscriptUpdateSnapshot;
    use serde_json::{Value, json};
    use std::error::Error;

    type TestResult = Result<(), Box<dyn Error>>;

    #[test]
    fn prompt_turn_contains_user_message_and_joined_agent_message() -> TestResult {
        let items = prompt_turn_items(PromptTurnInput {
            turn_id: "turn-1",
            prompt: &[json!({ "type": "text", "text": "prompt" })],
            updates: &[
                transcript_update(0, "agent_message_chunk", "fixture"),
                transcript_update(1, "agent_message_chunk", "-ready"),
            ],
            conduit_events: &[],
            status: TranscriptItemStatus::Complete,
            stop_reason: Some("end_turn"),
        });

        ensure_eq(&items.len(), &2usize, "prompt item count")?;
        assert_message(&items[0], MessageRole::User, "prompt")?;
        assert_message(&items[1], MessageRole::Agent, "fixture-ready")
    }

    #[test]
    fn failed_prompt_turn_with_error_event_does_not_add_empty_agent_message() -> TestResult {
        let items = prompt_turn_items(PromptTurnInput {
            turn_id: "turn-1",
            prompt: &[json!({ "type": "text", "text": "prompt" })],
            updates: &[],
            conduit_events: &[ConduitLocalTranscriptEvent {
                variant: "turn_error".to_owned(),
                data: json!({ "message": "provider failed" }),
            }],
            status: TranscriptItemStatus::Failed,
            stop_reason: None,
        });

        ensure_eq(&items.len(), &2usize, "prompt item count")?;
        let TranscriptItem::Event {
            source, variant, ..
        } = &items[1]
        else {
            return Err(format!("expected error event, got {:?}", items[1]).into());
        };
        ensure_eq(source, &TranscriptEventSource::Conduit, "event source")?;
        ensure_eq(variant, &"turn_error".to_owned(), "event variant")
    }

    fn transcript_update(index: usize, variant: &str, text: &str) -> TranscriptUpdateSnapshot {
        TranscriptUpdateSnapshot {
            index,
            variant: variant.to_owned(),
            update: json!({
                "sessionUpdate": variant,
                "content": { "type": "text", "text": text }
            }),
        }
    }

    fn assert_message(
        item: &TranscriptItem,
        expected_role: MessageRole,
        expected: &str,
    ) -> TestResult {
        let TranscriptItem::Message { content, role, .. } = item else {
            return Err(format!("expected message, got {item:?}").into());
        };
        ensure_eq(role, &expected_role, "message role")?;
        let text = content
            .iter()
            .filter_map(|block| block.get("text").and_then(Value::as_str))
            .collect::<String>();
        ensure_eq(&text, &expected.to_owned(), "message text")
    }

    fn ensure_eq<T>(actual: &T, expected: &T, label: &str) -> TestResult
    where
        T: std::fmt::Debug + PartialEq,
    {
        if actual == expected {
            return Ok(());
        }
        Err(format!("{label}: expected {expected:?}, got {actual:?}").into())
    }
}
