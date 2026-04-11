//! Conduit-owned loaded session history read model.

use crate::{Result, RuntimeError};
use acp_core::TranscriptUpdateSnapshot;
use acp_discovery::ProviderId;
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::HashMap;

const DEFAULT_HISTORY_LIMIT: usize = 40;
const MAX_HISTORY_LIMIT: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct OpenSessionKey {
    pub(crate) provider: ProviderId,
    pub(crate) session_id: String,
    pub(crate) cwd: String,
}

#[derive(Debug, Clone)]
pub(crate) struct OpenSessionTranscript {
    pub(crate) provider: ProviderId,
    items: Vec<TranscriptItem>,
}

#[derive(Debug, Default)]
pub(crate) struct SessionHistoryStore {
    next_open_session_sequence: u64,
    next_cursor_sequence: u64,
    open_sessions_by_key: HashMap<OpenSessionKey, String>,
    open_sessions: HashMap<String, OpenSessionTranscript>,
    cursors: HashMap<String, HistoryCursor>,
}

#[derive(Debug, Clone)]
struct HistoryCursor {
    open_session_id: String,
    end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
enum TranscriptItem {
    Message {
        id: String,
        role: MessageRole,
        text: String,
        source_variants: Vec<String>,
        created_at: Option<String>,
    },
    Event {
        id: String,
        variant: String,
        title: String,
        default_collapsed: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum MessageRole {
    User,
    Agent,
}

impl SessionHistoryStore {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn existing_open_session_id(&self, key: &OpenSessionKey) -> Option<String> {
        self.open_sessions_by_key.get(key).cloned()
    }

    pub(crate) fn open(
        &mut self,
        key: OpenSessionKey,
        updates: &[TranscriptUpdateSnapshot],
        limit: Option<u64>,
    ) -> Result<Value> {
        let open_session_id = self
            .existing_open_session_id(&key)
            .unwrap_or_else(|| self.next_open_session_id());
        let transcript = OpenSessionTranscript {
            provider: key.provider,
            items: project_items(updates),
        };
        self.open_sessions_by_key
            .insert(key, open_session_id.clone());
        self.open_sessions
            .insert(open_session_id.clone(), transcript);
        self.window("session/open", open_session_id, None, limit)
    }

    pub(crate) fn window(
        &mut self,
        command: &'static str,
        open_session_id: String,
        cursor: Option<String>,
        limit: Option<u64>,
    ) -> Result<Value> {
        let end = match cursor {
            Some(cursor) => self.take_cursor(&open_session_id, &cursor)?,
            None => self
                .open_sessions
                .get(&open_session_id)
                .ok_or(RuntimeError::InvalidParameter {
                    command,
                    parameter: "openSessionId",
                    message: "unknown open session",
                })?
                .items
                .len(),
        };
        let limit = normalize_limit(command, limit)?;
        let transcript =
            self.open_sessions
                .get(&open_session_id)
                .ok_or(RuntimeError::InvalidParameter {
                    command,
                    parameter: "openSessionId",
                    message: "unknown open session",
                })?;
        let start = end.saturating_sub(limit);
        let items = transcript.items[start..end].to_vec();
        let next_cursor = if start == 0 {
            None
        } else {
            Some(self.next_cursor(open_session_id.clone(), start))
        };
        Ok(json!({
            "openSessionId": open_session_id,
            "items": items,
            "nextCursor": next_cursor,
        }))
    }

    pub(crate) fn provider_for(&self, open_session_id: &str) -> Option<ProviderId> {
        self.open_sessions
            .get(open_session_id)
            .map(|transcript| transcript.provider)
    }

    fn take_cursor(&mut self, open_session_id: &str, cursor: &str) -> Result<usize> {
        let cursor = self
            .cursors
            .remove(cursor)
            .ok_or(RuntimeError::InvalidParameter {
                command: "session/history",
                parameter: "cursor",
                message: "unknown cursor",
            })?;
        if cursor.open_session_id != open_session_id {
            return Err(RuntimeError::InvalidParameter {
                command: "session/history",
                parameter: "cursor",
                message: "cursor belongs to another open session",
            });
        }
        Ok(cursor.end)
    }

    fn next_open_session_id(&mut self) -> String {
        self.next_open_session_sequence += 1;
        format!("open-session-{}", self.next_open_session_sequence)
    }

    fn next_cursor(&mut self, open_session_id: String, end: usize) -> String {
        self.next_cursor_sequence += 1;
        let cursor = format!("history-cursor-{}", self.next_cursor_sequence);
        self.cursors.insert(
            cursor.clone(),
            HistoryCursor {
                open_session_id,
                end,
            },
        );
        cursor
    }
}

fn project_items(updates: &[TranscriptUpdateSnapshot]) -> Vec<TranscriptItem> {
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
        role,
        text,
        source_variants: vec![update.variant.clone()],
        created_at: None,
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
        .and_then(Value::as_str)?
        .to_owned();
    Some((role, text))
}

fn event_title(update: &TranscriptUpdateSnapshot) -> String {
    update
        .update
        .get("title")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| update.variant.clone())
}

fn normalize_limit(command: &'static str, limit: Option<u64>) -> Result<usize> {
    let limit = limit.unwrap_or(DEFAULT_HISTORY_LIMIT as u64);
    if limit == 0 {
        return Err(RuntimeError::InvalidParameter {
            command,
            parameter: "limit",
            message: "limit must be greater than zero",
        });
    }
    Ok(limit.min(MAX_HISTORY_LIMIT as u64) as usize)
}
