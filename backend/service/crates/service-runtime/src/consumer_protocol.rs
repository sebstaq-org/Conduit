//! Backend-owned consumer protocol DTOs exported to frontend adapters.

use agent_client_protocol_schema as acp;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{ConsumerResponse, RuntimeEvent};

/// Transport protocol version for Conduit's consumer WebSocket frames.
pub const CONDUIT_TRANSPORT_VERSION: u8 = 1;

/// One server frame sent from backend to frontend consumers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum ConduitServerFrame {
    /// Command response frame.
    Response(ConduitServerResponseFrame),
    /// Runtime event frame.
    Event(ConduitServerEventFrame),
}

/// One server response frame.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ConduitServerResponseFrame {
    /// Transport protocol version.
    #[serde(rename = "v")]
    #[schemars(extend("const" = 1))]
    pub version: u8,
    /// Frame discriminator.
    #[serde(rename = "type")]
    #[schemars(extend("const" = "response"))]
    pub frame_type: String,
    /// Caller-owned request id echoed from the command frame.
    pub id: String,
    /// Command response payload.
    pub response: ConduitConsumerResponse,
}

impl ConduitServerResponseFrame {
    /// Creates one response frame from a runtime response.
    ///
    /// # Errors
    ///
    /// Returns an error if the optional runtime snapshot cannot be serialized.
    pub fn from_runtime_response(
        id: String,
        response: ConsumerResponse,
    ) -> serde_json::Result<Self> {
        Ok(Self {
            version: CONDUIT_TRANSPORT_VERSION,
            frame_type: "response".to_owned(),
            id,
            response: ConduitConsumerResponse::from_runtime_response(response)?,
        })
    }
}

/// One server event frame.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ConduitServerEventFrame {
    /// Transport protocol version.
    #[serde(rename = "v")]
    #[schemars(extend("const" = 1))]
    pub version: u8,
    /// Frame discriminator.
    #[serde(rename = "type")]
    #[schemars(extend("const" = "event"))]
    pub frame_type: String,
    /// Product runtime event payload.
    pub event: ConduitRuntimeEvent,
}

impl ConduitServerEventFrame {
    /// Creates one event frame.
    #[must_use]
    pub fn new(event: ConduitRuntimeEvent) -> Self {
        Self {
            version: CONDUIT_TRANSPORT_VERSION,
            frame_type: "event".to_owned(),
            event,
        }
    }
}

/// One stable consumer response envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ConduitConsumerResponse {
    /// Caller-owned request id echoed from the command.
    pub id: String,
    /// Whether the command completed successfully.
    pub ok: bool,
    /// ACP result payload or Conduit-owned command result.
    pub result: Value,
    /// Stable error payload when `ok` is false.
    pub error: Option<ConduitConsumerError>,
    /// Read-side snapshot after command handling when available.
    pub snapshot: Option<Value>,
}

impl ConduitConsumerResponse {
    /// Creates one exported consumer response from the runtime response envelope.
    ///
    /// # Errors
    ///
    /// Returns an error if the optional runtime snapshot cannot be serialized.
    pub fn from_runtime_response(response: ConsumerResponse) -> serde_json::Result<Self> {
        Ok(Self {
            id: response.id,
            ok: response.ok,
            result: response.result,
            error: response.error.map(ConduitConsumerError::from),
            snapshot: response.snapshot.map(serde_json::to_value).transpose()?,
        })
    }
}

/// Stable consumer error envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct ConduitConsumerError {
    /// Stable machine-readable error code.
    pub code: String,
    /// Human-readable error details.
    pub message: String,
}

impl From<crate::ConsumerError> for ConduitConsumerError {
    fn from(error: crate::ConsumerError) -> Self {
        Self {
            code: error.code,
            message: error.message,
        }
    }
}

/// Consumer-visible product event forwarded over the WebSocket transport.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ConduitRuntimeEvent {
    /// The session browser index changed.
    SessionsIndexChanged {
        /// New sessions index revision.
        revision: i64,
    },
    /// The open session timeline changed.
    SessionTimelineChanged {
        /// Opaque Conduit id for the opened session.
        open_session_id: String,
        /// New timeline revision.
        revision: i64,
        /// Changed transcript items when the update includes materialized rows.
        #[serde(skip_serializing_if = "Option::is_none")]
        items: Option<Vec<ConduitTranscriptItem>>,
    },
}

impl ConduitRuntimeEvent {
    /// Projects one watched runtime event into the consumer product protocol.
    ///
    /// # Errors
    ///
    /// Returns an error when the runtime payload does not match the consumer event contract.
    pub fn from_runtime_event(event: &RuntimeEvent) -> Result<Self, ConduitProtocolError> {
        match event.kind {
            crate::RuntimeEventKind::SessionsIndexChanged => Ok(Self::SessionsIndexChanged {
                revision: required_i64(&event.payload, "revision")?,
            }),
            crate::RuntimeEventKind::SessionTimelineChanged => Ok(Self::SessionTimelineChanged {
                open_session_id: required_string(&event.payload, "openSessionId")?,
                revision: required_i64(&event.payload, "revision")?,
                items: optional_transcript_items(&event.payload)?,
            }),
        }
    }
}

/// Consumer protocol projection error.
#[derive(Debug, thiserror::Error)]
pub enum ConduitProtocolError {
    /// A required field was missing or had the wrong type.
    #[error("runtime event payload field {field} is invalid")]
    InvalidField {
        /// Invalid field name.
        field: &'static str,
    },
    /// Transcript items failed the consumer protocol contract.
    #[error("runtime event payload field items is invalid: {source}")]
    InvalidItems {
        /// Underlying deserialization error.
        #[from]
        source: serde_json::Error,
    },
}

fn required_i64(payload: &Value, field: &'static str) -> Result<i64, ConduitProtocolError> {
    payload
        .get(field)
        .and_then(Value::as_i64)
        .ok_or(ConduitProtocolError::InvalidField { field })
}

fn required_string(payload: &Value, field: &'static str) -> Result<String, ConduitProtocolError> {
    payload
        .get(field)
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or(ConduitProtocolError::InvalidField { field })
}

fn optional_transcript_items(
    payload: &Value,
) -> Result<Option<Vec<ConduitTranscriptItem>>, ConduitProtocolError> {
    payload
        .get("items")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map_err(|source| ConduitProtocolError::InvalidItems { source })
}

/// One projected transcript item returned to UI consumers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ConduitTranscriptItem {
    /// User or agent ACP content.
    Message {
        /// Stable item id within the loaded transcript.
        id: String,
        /// Prompt turn id when the item belongs to a live prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        turn_id: Option<String>,
        /// Live prompt item status when the item is part of a prompt turn.
        #[serde(skip_serializing_if = "Option::is_none")]
        status: Option<ConduitTranscriptItemStatus>,
        /// ACP stop reason for the completed turn, when known.
        #[serde(skip_serializing_if = "Option::is_none")]
        stop_reason: Option<String>,
        /// Message author role.
        role: ConduitTranscriptMessageRole,
        /// ACP content blocks in transcript order.
        content: Vec<acp::ContentBlock>,
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
        status: Option<ConduitTranscriptItemStatus>,
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
pub enum ConduitTranscriptItemStatus {
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
pub enum ConduitTranscriptMessageRole {
    /// User-authored text.
    User,
    /// Agent-authored text.
    Agent,
}

/// Provider identifier in UI-facing consumer protocol results.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ConduitProviderId {
    /// Anthropic Claude via the official ACP adapter.
    Claude,
    /// GitHub Copilot via the official ACP adapter.
    Copilot,
    /// OpenAI Codex via the official ACP adapter.
    Codex,
}

/// One transcript history window returned to UI consumers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionHistoryWindow {
    /// Opaque Conduit id for the opened session.
    pub open_session_id: String,
    /// Current timeline revision for this opened session.
    pub revision: i64,
    /// Window of transcript items in display order.
    pub items: Vec<ConduitTranscriptItem>,
    /// Cursor for the next older page, when one exists.
    pub next_cursor: Option<String>,
}

/// Result returned by `session/new`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionNewResult {
    /// ACP session id returned by the provider.
    pub session_id: String,
    /// Provider configuration options for the new session.
    pub config_options: Option<Vec<acp::SessionConfigOption>>,
    /// Provider mode metadata.
    pub modes: Option<Value>,
    /// Provider model metadata.
    pub models: Option<Value>,
    /// Currently selected provider mode id.
    pub current_mode_id: Option<String>,
    /// Initial history window for the new session.
    pub history: ConduitSessionHistoryWindow,
}

/// Result returned by `session/open`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionOpenResult {
    /// ACP session id returned by the provider.
    pub session_id: String,
    /// Provider configuration options for the opened session.
    pub config_options: Option<Vec<acp::SessionConfigOption>>,
    /// Provider mode metadata.
    pub modes: Option<Value>,
    /// Provider model metadata.
    pub models: Option<Value>,
    /// Currently selected provider mode id.
    pub current_mode_id: Option<String>,
    /// Opaque Conduit id for the opened session.
    pub open_session_id: String,
    /// Current timeline revision for this opened session.
    pub revision: i64,
    /// Window of transcript items in display order.
    pub items: Vec<ConduitTranscriptItem>,
    /// Cursor for the next older page, when one exists.
    pub next_cursor: Option<String>,
}

/// Result returned by `session/set_config_option`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionSetConfigOptionResult {
    /// ACP session id returned by the provider.
    pub session_id: String,
    /// Current provider configuration options.
    pub config_options: Vec<acp::SessionConfigOption>,
}

/// Result returned by `session/history`.
pub type ConduitSessionHistoryResult = ConduitSessionHistoryWindow;

/// Result returned by `projects/list` and project mutation commands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitProjectListView {
    /// Persisted session browser projects.
    pub projects: Vec<ConduitProjectRow>,
}

/// One persisted project row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitProjectRow {
    /// Stable render and mutation identity for the project.
    pub project_id: String,
    /// Absolute normalized cwd represented by this project.
    pub cwd: String,
    /// User-facing project label.
    pub display_name: String,
}

/// Result returned by `projects/suggestions`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitProjectSuggestionsView {
    /// Addable cwd suggestions.
    pub suggestions: Vec<ConduitProjectSuggestion>,
}

/// One addable cwd suggestion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitProjectSuggestion {
    /// Stable render identity for the suggestion.
    pub suggestion_id: String,
    /// Absolute normalized cwd represented by this suggestion.
    pub cwd: String,
}

/// Result returned by `settings/get` and `settings/update`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitGlobalSettingsView {
    /// Default session lookback window in days for `sessions/grouped`.
    pub session_groups_updated_within_days: Option<u64>,
}

/// Result returned by `sessions/grouped`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionGroupsView {
    /// Current session index revision.
    pub revision: i64,
    /// Last refresh timestamp, when available.
    pub refreshed_at: Option<String>,
    /// Whether a refresh is still pending.
    pub is_refreshing: bool,
    /// Grouped sessions by persisted project.
    pub groups: Vec<ConduitSessionGroup>,
}

/// One project-backed session group.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionGroup {
    /// Stable group identity.
    pub group_id: String,
    /// Absolute normalized cwd represented by this group.
    pub cwd: String,
    /// User-facing group label.
    pub display_name: String,
    /// Sessions in this group.
    pub sessions: Vec<ConduitSessionRow>,
}

/// One session row in a grouped sessions result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionRow {
    /// Provider that owns the ACP session.
    pub provider: ConduitProviderId,
    /// Provider-issued ACP session id.
    pub session_id: String,
    /// Provider-supplied session title.
    pub title: Option<String>,
    /// Provider-supplied update timestamp.
    pub updated_at: Option<String>,
}

/// Result returned by `providers/config_snapshot`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitProvidersConfigSnapshotResult {
    /// Provider config snapshot entries.
    pub entries: Vec<ConduitProviderConfigSnapshotEntry>,
}

/// One provider config snapshot entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitProviderConfigSnapshotEntry {
    /// Provider represented by this entry.
    pub provider: ConduitProviderId,
    /// Snapshot status.
    pub status: ConduitProviderConfigSnapshotStatus,
    /// Provider configuration options when available.
    pub config_options: Option<Vec<acp::SessionConfigOption>>,
    /// Provider mode metadata.
    pub modes: Option<Value>,
    /// Provider model metadata.
    pub models: Option<Value>,
    /// Fetch timestamp when available.
    pub fetched_at: Option<String>,
    /// Human-readable error when the snapshot failed.
    pub error: Option<String>,
}

/// Provider config snapshot status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ConduitProviderConfigSnapshotStatus {
    /// Snapshot is loading.
    Loading,
    /// Snapshot is ready.
    Ready,
    /// Snapshot failed.
    Error,
    /// Provider executable is unavailable.
    Unavailable,
}

/// Result returned by `sessions/watch`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionsWatchResult {
    /// Whether the subscription was accepted.
    pub subscribed: bool,
}

/// Result returned by `session/watch`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConduitSessionWatchResult {
    /// Whether the subscription was accepted.
    pub subscribed: bool,
    /// Opaque Conduit id for the opened session.
    pub open_session_id: String,
}
