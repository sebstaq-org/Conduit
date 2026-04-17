//! Prompt-turn projection helpers for session timelines.

use acp_core::TranscriptUpdateSnapshot;
use serde_json::Value;

use crate::{MessageRole, TranscriptItem, TranscriptItemStatus, project_prompt_turn_items};

/// Projects one prompt turn into user-visible transcript items.
pub fn prompt_turn_items(
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

#[cfg(test)]
mod tests {
    use super::prompt_turn_items;
    use crate::{MessageRole, TranscriptItem, TranscriptItemStatus};
    use acp_core::TranscriptUpdateSnapshot;
    use serde_json::{Value, json};
    use std::error::Error;

    type TestResult = Result<(), Box<dyn Error>>;

    #[test]
    fn prompt_turn_contains_user_message_and_joined_agent_message() -> TestResult {
        let items = prompt_turn_items(
            "turn-1",
            &[json!({ "type": "text", "text": "prompt" })],
            &[
                transcript_update(0, "agent_message_chunk", "fixture"),
                transcript_update(1, "agent_message_chunk", "-ready"),
            ],
            TranscriptItemStatus::Complete,
            Some("end_turn"),
        );

        ensure_eq(&items.len(), &2usize, "prompt item count")?;
        assert_message(&items[0], MessageRole::User, "prompt")?;
        assert_message(&items[1], MessageRole::Agent, "fixture-ready")
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
