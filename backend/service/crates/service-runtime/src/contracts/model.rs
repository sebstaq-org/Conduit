//! Backend-owned request, result, and read-model contracts.

use super::{MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS, MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS};
use acp_discovery::ProviderId;
use agent_client_protocol_schema::{ContentBlock, SessionConfigOption, SessionModeState};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use session_store::{ProjectRow, ProjectSuggestion, SessionHistoryWindow, TranscriptItem};

/// Query parameters for `sessions/grouped`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionGroupsQuery {
    /// Optional lookback window in days.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        serialize_with = "::serde_with::rust::double_option::serialize",
        deserialize_with = "::serde_with::rust::double_option::deserialize"
    )]
    #[schemars(range(min = MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS, max = MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS))]
    pub updated_within_days: Option<Option<u64>>,
}

/// One session row inside a grouped session view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionRow {
    /// Provider owning the session.
    pub provider: ProviderId,
    /// ACP session identifier.
    pub session_id: String,
    /// Human-readable session title when available.
    pub title: Option<String>,
    /// Last activity timestamp when available.
    pub updated_at: Option<String>,
}

/// One grouped session-browser project view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionGroup {
    /// Stable project group identity.
    pub group_id: String,
    /// Absolute normalized cwd represented by the group.
    pub cwd: String,
    /// User-facing project label.
    pub display_name: String,
    /// Sessions currently grouped under the project.
    pub sessions: Vec<SessionRow>,
}

/// Session browser grouped read model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionGroupsView {
    /// Session-index revision after the grouped projection.
    pub revision: i64,
    /// Last refresh timestamp when available.
    pub refreshed_at: Option<String>,
    /// Whether the view is still warming up in the background.
    pub is_refreshing: bool,
    /// Grouped projects and their sessions.
    pub groups: Vec<SessionGroup>,
}

/// Request payload for `projects/add`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectAddRequest {
    /// Absolute normalized cwd to add as a project.
    pub cwd: String,
}

/// Request payload for `projects/remove`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectRemoveRequest {
    /// Stable project identity to remove.
    pub project_id: String,
}

/// Request payload for `projects/update`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectUpdateRequest {
    /// Stable project identity to update.
    pub project_id: String,
    /// New display label for the project.
    pub display_name: String,
}

/// Query payload for `projects/suggestions`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectSuggestionsQuery {
    /// Optional substring filter.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    /// Optional result limit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
}

/// Project list read model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectListView {
    /// Persisted projects in display order.
    pub projects: Vec<ProjectRow>,
}

/// Project suggestions read model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectSuggestionsView {
    /// Addable project suggestions.
    pub suggestions: Vec<ProjectSuggestion>,
}

/// Request payload for `settings/update`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GlobalSettingsUpdateRequest {
    /// Default lookback window for `sessions/grouped`.
    #[schemars(range(min = MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS, max = MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS))]
    pub session_groups_updated_within_days: Option<u64>,
}

/// Request payload for `session/new`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionNewRequest {
    /// Absolute normalized cwd for the new session.
    pub cwd: String,
    /// Optional initial transcript window size.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
}

/// Request payload for `session/open`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionOpenRequest {
    /// Provider ACP session identifier.
    pub session_id: String,
    /// Absolute normalized cwd identity for the session.
    pub cwd: String,
    /// Optional transcript window size.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
}

/// Request payload for `session/history`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionHistoryRequest {
    /// Open-session identity allocated by Conduit.
    pub open_session_id: String,
    /// Optional older-page cursor.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    /// Optional history window size.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
}

/// Request payload for `session/watch`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionWatchRequest {
    /// Open-session identity allocated by Conduit.
    pub open_session_id: String,
}

/// Request payload for `session/prompt`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionPromptRequest {
    /// Open-session identity allocated by Conduit.
    pub open_session_id: String,
    /// ACP content blocks for the prompt.
    pub prompt: Vec<ContentBlock>,
}

/// Request payload for `session/set_config_option`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionSetConfigOptionRequest {
    /// Provider ACP session identifier.
    pub session_id: String,
    /// ACP config option identifier.
    pub config_id: String,
    /// Selected config value identifier.
    pub value: String,
}

/// Provider-backed state stored for session/open projections.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionStateProjection {
    /// Provider ACP session identifier.
    pub session_id: String,
    /// Official ACP mode state when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modes: Option<SessionModeState>,
    /// Provider model state when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Value>,
    /// Session configuration options when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_options: Option<Vec<SessionConfigOption>>,
}

/// Result payload for `session/new`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionNewResult {
    /// Provider ACP session identifier.
    pub session_id: String,
    /// Official ACP mode state when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modes: Option<SessionModeState>,
    /// Provider model state when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Value>,
    /// Session configuration options when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_options: Option<Vec<SessionConfigOption>>,
    /// Initial transcript history window.
    pub history: SessionHistoryWindow,
}

/// Result payload for `session/open`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionOpenResult {
    /// Provider ACP session identifier.
    pub session_id: String,
    /// Official ACP mode state when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modes: Option<SessionModeState>,
    /// Provider model state when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub models: Option<Value>,
    /// Session configuration options when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_options: Option<Vec<SessionConfigOption>>,
    /// Open-session identity allocated by Conduit.
    pub open_session_id: String,
    /// Current history revision.
    pub revision: i64,
    /// Window of transcript items in display order.
    pub items: Vec<TranscriptItem>,
    /// Cursor for the next older page when one exists.
    pub next_cursor: Option<String>,
}

/// Result payload for `session/set_config_option`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionSetConfigOptionResult {
    /// Provider ACP session identifier.
    pub session_id: String,
    /// Updated session configuration options.
    pub config_options: Vec<SessionConfigOption>,
}

/// Snapshot worker status for provider config data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ProviderConfigSnapshotStatus {
    /// The worker has not completed its first probe yet.
    Loading,
    /// A fresh config snapshot is available.
    Ready,
    /// The provider was reachable but returned an error.
    Error,
    /// The provider could not be launched in the current environment.
    Unavailable,
}

/// One provider config snapshot entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderConfigSnapshotEntry {
    /// Provider identifier.
    pub provider: ProviderId,
    /// Snapshot status.
    pub status: ProviderConfigSnapshotStatus,
    /// Provider config options when available.
    pub config_options: Option<Vec<SessionConfigOption>>,
    /// Official ACP mode state when available.
    pub modes: Option<SessionModeState>,
    /// Provider model state when available.
    pub models: Option<Value>,
    /// Probe completion timestamp when available.
    pub fetched_at: Option<String>,
    /// Probe error message when available.
    pub error: Option<String>,
}

/// Result payload for `providers/config_snapshot`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProvidersConfigSnapshotResult {
    /// Snapshot entry for each supported provider.
    pub entries: Vec<ProviderConfigSnapshotEntry>,
}
