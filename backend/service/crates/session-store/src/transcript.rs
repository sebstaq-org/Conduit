//! Transcript projection primitives for Conduit history windows.

use acp_core::TranscriptUpdateSnapshot;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// One projected transcript item for UI consumption.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
        content: Vec<Value>,
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
            Some((role, content)) => {
                append_content_item(&mut items, update.index, role, content);
                append_terminal_plan_event(&mut items, None, None, None, &update);
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
    items
}

/// Projects live prompt-turn updates into UI transcript items.
pub(crate) fn project_prompt_turn_items(
    turn_id: &str,
    updates: &[TranscriptUpdateSnapshot],
    status: TranscriptItemStatus,
    stop_reason: Option<&str>,
) -> Vec<TranscriptItem> {
    let mut updates = updates.to_vec();
    updates.sort_by_key(|update| update.index);
    let mut items = Vec::new();
    for update in updates {
        match text_role(&update) {
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
                append_terminal_plan_event(
                    &mut items,
                    Some(turn_id),
                    Some(status),
                    stop_reason,
                    &update,
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
    items
}

fn append_content_item(
    items: &mut Vec<TranscriptItem>,
    index: usize,
    role: MessageRole,
    content: Value,
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
    content: Value,
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

fn text_role(update: &TranscriptUpdateSnapshot) -> Option<(MessageRole, Value)> {
    let role = match update.variant.as_str() {
        "user_message_chunk" => MessageRole::User,
        "agent_message_chunk" => MessageRole::Agent,
        _ => return None,
    };
    let content = update.update.get("content")?.clone();
    Some((role, content))
}

fn append_terminal_plan_event(
    items: &mut Vec<TranscriptItem>,
    turn_id: Option<&str>,
    status: Option<TranscriptItemStatus>,
    stop_reason: Option<&str>,
    update: &TranscriptUpdateSnapshot,
) {
    let Some(data) = terminal_plan_data(update) else {
        return;
    };
    let id_prefix = turn_id.unwrap_or("transcript");
    items.push(TranscriptItem::Event {
        id: format!("{id_prefix}-update-{}-terminal-plan", update.index),
        turn_id: turn_id.map(ToOwned::to_owned),
        status,
        stop_reason: stop_reason.map(ToOwned::to_owned),
        variant: "terminal_plan".to_owned(),
        data,
    });
}

fn terminal_plan_data(update: &TranscriptUpdateSnapshot) -> Option<Value> {
    let plan = update.update.pointer("/_meta/codex/terminalPlan")?;
    let item_id = plan.get("itemId").and_then(Value::as_str)?;
    let plan_text = plan.get("text").and_then(Value::as_str)?;
    let provider_source = plan.get("source").and_then(Value::as_str)?;
    if provider_source != "TurnItem::Plan" {
        return None;
    }
    if update
        .update
        .pointer("/content/text")
        .and_then(Value::as_str)?
        != plan_text
    {
        return None;
    }
    let mut data = Map::new();
    data.insert(
        "sessionUpdate".to_owned(),
        Value::String("terminal_plan".to_owned()),
    );
    data.insert(
        "interactionId".to_owned(),
        Value::String(format!("terminal-plan:{item_id}")),
    );
    data.insert(
        "source".to_owned(),
        Value::String("codex.terminalPlan".to_owned()),
    );
    data.insert(
        "providerSource".to_owned(),
        Value::String(provider_source.to_owned()),
    );
    data.insert("itemId".to_owned(), Value::String(item_id.to_owned()));
    data.insert("planText".to_owned(), Value::String(plan_text.to_owned()));
    data.insert("status".to_owned(), Value::String("pending".to_owned()));
    if let Some(codex_turn_id) = plan.get("turnId").and_then(Value::as_str) {
        data.insert(
            "codexTurnId".to_owned(),
            Value::String(codex_turn_id.to_owned()),
        );
    }
    if let Some(thread_id) = plan.get("threadId").and_then(Value::as_str) {
        data.insert("threadId".to_owned(), Value::String(thread_id.to_owned()));
    }
    Some(Value::Object(data))
}

#[cfg(test)]
mod tests {
    use super::{MessageRole, TranscriptItem, TranscriptItemStatus, project_prompt_turn_items};
    use acp_core::TranscriptUpdateSnapshot;
    use serde_json::{Value, json};
    use std::error::Error;

    type TestResult = Result<(), Box<dyn Error>>;

    #[test]
    fn terminal_plan_meta_projects_agent_message_and_terminal_plan_event() -> TestResult {
        let items = project_prompt_turn_items(
            "turn-1",
            &[terminal_plan_update()],
            TranscriptItemStatus::Complete,
            Some("end_turn"),
        );

        ensure_eq(&items.len(), &2usize, "terminal plan item count")?;
        assert_agent_message(&items[0])?;
        assert_terminal_plan_event(&items[1])
    }

    #[test]
    fn plain_agent_message_chunk_does_not_create_terminal_plan_event() {
        let items = project_prompt_turn_items(
            "turn-1",
            &[TranscriptUpdateSnapshot {
                index: 0,
                variant: "agent_message_chunk".to_owned(),
                update: json!({
                    "sessionUpdate": "agent_message_chunk",
                    "content": {
                        "type": "text",
                        "text": "normal markdown"
                    }
                }),
            }],
            TranscriptItemStatus::Complete,
            None,
        );

        assert_eq!(items.len(), 1);
    }

    #[test]
    fn terminal_plan_meta_requires_turn_item_plan_source() {
        let items = project_prompt_turn_items(
            "turn-1",
            &[terminal_plan_update_with(json!({
                "source": "AgentMessage::FinalAnswer",
                "text": "# Plan\n",
                "itemId": "item-plan",
                "turnId": "codex-turn",
                "threadId": "codex-thread"
            }))],
            TranscriptItemStatus::Complete,
            None,
        );

        assert_eq!(items.len(), 1);
    }

    #[test]
    fn terminal_plan_meta_requires_visible_text_match() {
        let items = project_prompt_turn_items(
            "turn-1",
            &[terminal_plan_update_with(json!({
                "source": "TurnItem::Plan",
                "text": "# Different Plan\n",
                "itemId": "item-plan",
                "turnId": "codex-turn",
                "threadId": "codex-thread"
            }))],
            TranscriptItemStatus::Complete,
            None,
        );

        assert_eq!(items.len(), 1);
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

    fn terminal_plan_update() -> TranscriptUpdateSnapshot {
        terminal_plan_update_with(json!({
            "source": "TurnItem::Plan",
            "text": "# Plan\n",
            "itemId": "item-plan",
            "turnId": "codex-turn",
            "threadId": "codex-thread"
        }))
    }

    fn terminal_plan_update_with(plan: Value) -> TranscriptUpdateSnapshot {
        TranscriptUpdateSnapshot {
            index: 0,
            variant: "agent_message_chunk".to_owned(),
            update: json!({
                "sessionUpdate": "agent_message_chunk",
                "content": { "type": "text", "text": "# Plan\n" },
                "_meta": {
                    "codex": {
                        "terminalPlan": plan
                    }
                }
            }),
        }
    }

    fn assert_agent_message(item: &TranscriptItem) -> TestResult {
        let TranscriptItem::Message { content, role, .. } = item else {
            return Err(format!("expected message item, got {item:?}").into());
        };
        ensure_eq(role, &MessageRole::Agent, "message role")?;
        ensure_eq(
            &content[0].get("text").and_then(Value::as_str),
            &Some("# Plan\n"),
            "message text",
        )?;
        Ok(())
    }

    fn assert_terminal_plan_event(item: &TranscriptItem) -> TestResult {
        let TranscriptItem::Event {
            variant,
            data,
            status,
            stop_reason,
            ..
        } = item
        else {
            return Err(format!("expected terminal_plan event, got {item:?}").into());
        };
        ensure_eq(variant, &"terminal_plan".to_owned(), "event variant")?;
        ensure_eq(
            status,
            &Some(TranscriptItemStatus::Complete),
            "event status",
        )?;
        ensure_eq(&stop_reason.as_deref(), &Some("end_turn"), "stop reason")?;
        ensure_str(data, "sessionUpdate", "terminal_plan")?;
        ensure_str(data, "interactionId", "terminal-plan:item-plan")?;
        ensure_str(data, "providerSource", "TurnItem::Plan")?;
        ensure_str(data, "planText", "# Plan\n")?;
        ensure_str(data, "codexTurnId", "codex-turn")?;
        ensure_str(data, "threadId", "codex-thread")?;
        Ok(())
    }

    fn ensure_str(data: &Value, field: &str, expected: &str) -> TestResult {
        ensure_eq(
            &data.get(field).and_then(Value::as_str),
            &Some(expected),
            field,
        )
    }
}
