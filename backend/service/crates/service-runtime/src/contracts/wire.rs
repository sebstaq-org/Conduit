//! Backend-owned wire and transport contracts.

use super::TRANSPORT_PROTOCOL_VERSION;
use super::model::{
    GlobalSettingsUpdateRequest, ProjectAddRequest, ProjectRemoveRequest, ProjectSuggestionsQuery,
    ProjectUpdateRequest, SessionGroupsQuery, SessionHistoryRequest, SessionOpenRequest,
    SessionPromptRequest, SessionSetConfigOptionRequest, SessionWatchRequest,
};
use acp_core::ProviderSnapshot;
use acp_discovery::ProviderId;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use session_store::TranscriptItem;

/// Stable set of supported consumer command names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum ConsumerCommandName {
    /// ACP provider initialization.
    #[serde(rename = "initialize")]
    Initialize,
    /// ACP session creation.
    #[serde(rename = "session/new")]
    SessionNew,
    /// ACP session config mutation.
    #[serde(rename = "session/set_config_option")]
    SessionSetConfigOption,
    /// ACP prompt submission for an open session.
    #[serde(rename = "session/prompt")]
    SessionPrompt,
    /// ACP session cancellation.
    #[serde(rename = "session/cancel")]
    SessionCancel,
    /// Disconnects one provider session runtime.
    #[serde(rename = "provider/disconnect")]
    ProviderDisconnect,
    /// Adds one persisted project.
    #[serde(rename = "projects/add")]
    ProjectsAdd,
    /// Lists persisted projects.
    #[serde(rename = "projects/list")]
    ProjectsList,
    /// Removes one persisted project.
    #[serde(rename = "projects/remove")]
    ProjectsRemove,
    /// Suggests projects from the local environment.
    #[serde(rename = "projects/suggestions")]
    ProjectsSuggestions,
    /// Updates one persisted project.
    #[serde(rename = "projects/update")]
    ProjectsUpdate,
    /// Reads global settings.
    #[serde(rename = "settings/get")]
    SettingsGet,
    /// Updates global settings.
    #[serde(rename = "settings/update")]
    SettingsUpdate,
    /// Reads grouped sessions.
    #[serde(rename = "sessions/grouped")]
    SessionsGrouped,
    /// Subscribes to session-index changes.
    #[serde(rename = "sessions/watch")]
    SessionsWatch,
    /// Reads provider config snapshots.
    #[serde(rename = "providers/config_snapshot")]
    ProvidersConfigSnapshot,
    /// Opens one known provider session.
    #[serde(rename = "session/open")]
    SessionOpen,
    /// Reads one session history window.
    #[serde(rename = "session/history")]
    SessionHistory,
    /// Subscribes to one open-session timeline.
    #[serde(rename = "session/watch")]
    SessionWatch,
}

/// Global provider target for commands that must fan out through Conduit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum GlobalProviderTarget {
    /// Targets the aggregate Conduit runtime.
    #[serde(rename = "all")]
    All,
}

/// One provider target accepted by consumer commands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum ConsumerCommandTarget {
    /// One specific provider.
    Provider(ProviderId),
    /// The aggregate runtime target.
    Global(GlobalProviderTarget),
}

/// Empty object params for commands without a request payload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct EmptyParams {}

/// Request payload for `session/cancel`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SessionCancelRequest {
    /// Provider ACP session identifier.
    pub session_id: String,
}

string_literal_enum!(InitializeCommandLiteral, "initialize");
string_literal_enum!(SessionNewCommandLiteral, "session/new");
string_literal_enum!(
    SessionSetConfigOptionCommandLiteral,
    "session/set_config_option"
);
string_literal_enum!(SessionPromptCommandLiteral, "session/prompt");
string_literal_enum!(SessionCancelCommandLiteral, "session/cancel");
string_literal_enum!(ProviderDisconnectCommandLiteral, "provider/disconnect");
string_literal_enum!(ProjectsAddCommandLiteral, "projects/add");
string_literal_enum!(ProjectsListCommandLiteral, "projects/list");
string_literal_enum!(ProjectsRemoveCommandLiteral, "projects/remove");
string_literal_enum!(ProjectsSuggestionsCommandLiteral, "projects/suggestions");
string_literal_enum!(ProjectsUpdateCommandLiteral, "projects/update");
string_literal_enum!(SettingsGetCommandLiteral, "settings/get");
string_literal_enum!(SettingsUpdateCommandLiteral, "settings/update");
string_literal_enum!(SessionsGroupedCommandLiteral, "sessions/grouped");
string_literal_enum!(SessionsWatchCommandLiteral, "sessions/watch");
string_literal_enum!(
    ProvidersConfigSnapshotCommandLiteral,
    "providers/config_snapshot"
);
string_literal_enum!(SessionOpenCommandLiteral, "session/open");
string_literal_enum!(SessionHistoryCommandLiteral, "session/history");
string_literal_enum!(SessionWatchCommandLiteral, "session/watch");
string_literal_enum!(ClientCommandFrameType, "command");
string_literal_enum!(ServerResponseFrameType, "response");
string_literal_enum!(ServerEventFrameType, "event");

macro_rules! command_struct {
    ($(#[$meta:meta])* $name:ident, $literal:ident, $provider:ty, $params:ty) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        pub struct $name {
            /// Caller-owned request id echoed in the response.
            #[schemars(length(min = 1))]
            pub id: String,
            /// Stable command discriminator.
            pub command: $literal,
            /// Command target.
            pub provider: $provider,
            /// Command params.
            pub params: $params,
        }
    };
}

command_struct!(
    /// Wire command envelope for `initialize`.
    InitializeConsumerCommand,
    InitializeCommandLiteral,
    ProviderId,
    EmptyParams
);
command_struct!(
    /// Wire command envelope for `session/new`.
    SessionNewConsumerCommand,
    SessionNewCommandLiteral,
    ProviderId,
    super::model::SessionNewRequest
);
command_struct!(
    /// Wire command envelope for `session/set_config_option`.
    SessionSetConfigOptionConsumerCommand,
    SessionSetConfigOptionCommandLiteral,
    ProviderId,
    SessionSetConfigOptionRequest
);
command_struct!(
    /// Wire command envelope for `session/prompt`.
    SessionPromptConsumerCommand,
    SessionPromptCommandLiteral,
    GlobalProviderTarget,
    SessionPromptRequest
);
command_struct!(
    /// Wire command envelope for `session/cancel`.
    SessionCancelConsumerCommand,
    SessionCancelCommandLiteral,
    ProviderId,
    SessionCancelRequest
);
command_struct!(
    /// Wire command envelope for `provider/disconnect`.
    ProviderDisconnectConsumerCommand,
    ProviderDisconnectCommandLiteral,
    ProviderId,
    EmptyParams
);
command_struct!(
    /// Wire command envelope for `projects/add`.
    ProjectsAddConsumerCommand,
    ProjectsAddCommandLiteral,
    GlobalProviderTarget,
    ProjectAddRequest
);
command_struct!(
    /// Wire command envelope for `projects/list`.
    ProjectsListConsumerCommand,
    ProjectsListCommandLiteral,
    GlobalProviderTarget,
    EmptyParams
);
command_struct!(
    /// Wire command envelope for `projects/remove`.
    ProjectsRemoveConsumerCommand,
    ProjectsRemoveCommandLiteral,
    GlobalProviderTarget,
    ProjectRemoveRequest
);
command_struct!(
    /// Wire command envelope for `projects/suggestions`.
    ProjectsSuggestionsConsumerCommand,
    ProjectsSuggestionsCommandLiteral,
    GlobalProviderTarget,
    ProjectSuggestionsQuery
);
command_struct!(
    /// Wire command envelope for `projects/update`.
    ProjectsUpdateConsumerCommand,
    ProjectsUpdateCommandLiteral,
    GlobalProviderTarget,
    ProjectUpdateRequest
);
command_struct!(
    /// Wire command envelope for `settings/get`.
    SettingsGetConsumerCommand,
    SettingsGetCommandLiteral,
    GlobalProviderTarget,
    EmptyParams
);
command_struct!(
    /// Wire command envelope for `settings/update`.
    SettingsUpdateConsumerCommand,
    SettingsUpdateCommandLiteral,
    GlobalProviderTarget,
    GlobalSettingsUpdateRequest
);
command_struct!(
    /// Wire command envelope for `sessions/grouped`.
    SessionsGroupedConsumerCommand,
    SessionsGroupedCommandLiteral,
    ConsumerCommandTarget,
    SessionGroupsQuery
);
command_struct!(
    /// Wire command envelope for `sessions/watch`.
    SessionsWatchConsumerCommand,
    SessionsWatchCommandLiteral,
    GlobalProviderTarget,
    EmptyParams
);
command_struct!(
    /// Wire command envelope for `providers/config_snapshot`.
    ProvidersConfigSnapshotConsumerCommand,
    ProvidersConfigSnapshotCommandLiteral,
    GlobalProviderTarget,
    EmptyParams
);
command_struct!(
    /// Wire command envelope for `session/open`.
    SessionOpenConsumerCommand,
    SessionOpenCommandLiteral,
    ProviderId,
    SessionOpenRequest
);
command_struct!(
    /// Wire command envelope for `session/history`.
    SessionHistoryConsumerCommand,
    SessionHistoryCommandLiteral,
    GlobalProviderTarget,
    SessionHistoryRequest
);
command_struct!(
    /// Wire command envelope for `session/watch`.
    SessionWatchConsumerCommand,
    SessionWatchCommandLiteral,
    GlobalProviderTarget,
    SessionWatchRequest
);

/// One stable wire command envelope accepted by the product transport.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum ConsumerCommand {
    /// ACP provider initialization.
    Initialize(InitializeConsumerCommand),
    /// ACP session creation.
    SessionNew(SessionNewConsumerCommand),
    /// ACP session config mutation.
    SessionSetConfigOption(SessionSetConfigOptionConsumerCommand),
    /// ACP prompt submission.
    SessionPrompt(SessionPromptConsumerCommand),
    /// ACP session cancellation.
    SessionCancel(SessionCancelConsumerCommand),
    /// Provider disconnect.
    ProviderDisconnect(ProviderDisconnectConsumerCommand),
    /// Project addition.
    ProjectsAdd(ProjectsAddConsumerCommand),
    /// Project list.
    ProjectsList(ProjectsListConsumerCommand),
    /// Project removal.
    ProjectsRemove(ProjectsRemoveConsumerCommand),
    /// Project suggestions.
    ProjectsSuggestions(ProjectsSuggestionsConsumerCommand),
    /// Project update.
    ProjectsUpdate(ProjectsUpdateConsumerCommand),
    /// Settings read.
    SettingsGet(SettingsGetConsumerCommand),
    /// Settings update.
    SettingsUpdate(SettingsUpdateConsumerCommand),
    /// Session groups read.
    SessionsGrouped(SessionsGroupedConsumerCommand),
    /// Session-index watch.
    SessionsWatch(SessionsWatchConsumerCommand),
    /// Provider config snapshot read.
    ProvidersConfigSnapshot(ProvidersConfigSnapshotConsumerCommand),
    /// Session open.
    SessionOpen(SessionOpenConsumerCommand),
    /// Session history read.
    SessionHistory(SessionHistoryConsumerCommand),
    /// Session timeline watch.
    SessionWatch(SessionWatchConsumerCommand),
}

/// Stable consumer error envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConsumerError {
    /// Stable machine-readable error code.
    pub code: String,
    /// Human-readable error details.
    pub message: String,
}

/// One stable consumer response envelope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConsumerResponse {
    /// Caller-owned request id echoed from the command.
    #[schemars(length(min = 1))]
    pub id: String,
    /// Whether the command completed successfully.
    pub ok: bool,
    /// ACP result payload or Conduit-owned command result.
    pub result: Value,
    /// Stable error payload when `ok` is false.
    pub error: Option<ConsumerError>,
    /// Read-side snapshot after command handling when available.
    pub snapshot: Option<ProviderSnapshot>,
}

/// One UI-facing runtime event emitted on the WebSocket stream.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum RuntimeEvent {
    /// The grouped session index changed.
    SessionsIndexChanged {
        /// Current session-index revision.
        revision: i64,
    },
    /// One open-session timeline changed.
    SessionTimelineChanged {
        /// Open-session identity allocated by Conduit.
        open_session_id: String,
        /// Current timeline revision.
        revision: i64,
        /// Replacement items for the affected prompt turn when available.
        #[serde(skip_serializing_if = "Option::is_none")]
        items: Option<Vec<TranscriptItem>>,
    },
}

/// Versioned WebSocket frame carrying a client command.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClientCommandFrame {
    /// Transport protocol version.
    #[schemars(range(min = TRANSPORT_PROTOCOL_VERSION, max = TRANSPORT_PROTOCOL_VERSION))]
    pub v: u8,
    /// Stable frame discriminator.
    #[serde(rename = "type")]
    pub frame_type: ClientCommandFrameType,
    /// Correlation id echoed in responses.
    #[schemars(length(min = 1))]
    pub id: String,
    /// Consumer command payload.
    pub command: ConsumerCommand,
}

/// Versioned WebSocket frame carrying a command response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ServerResponseFrame {
    /// Transport protocol version.
    #[schemars(range(min = TRANSPORT_PROTOCOL_VERSION, max = TRANSPORT_PROTOCOL_VERSION))]
    pub v: u8,
    /// Stable frame discriminator.
    #[serde(rename = "type")]
    pub frame_type: ServerResponseFrameType,
    /// Correlation id echoed from the command.
    #[schemars(length(min = 1))]
    pub id: String,
    /// Consumer response payload.
    pub response: Box<ConsumerResponse>,
}

/// Versioned WebSocket frame carrying one runtime event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ServerEventFrame {
    /// Transport protocol version.
    #[schemars(range(min = TRANSPORT_PROTOCOL_VERSION, max = TRANSPORT_PROTOCOL_VERSION))]
    pub v: u8,
    /// Stable frame discriminator.
    #[serde(rename = "type")]
    pub frame_type: ServerEventFrameType,
    /// Event payload.
    pub event: RuntimeEvent,
}

/// One server-to-client WebSocket frame.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerFrame {
    /// Command response frame.
    Response {
        /// Transport protocol version.
        #[schemars(range(min = TRANSPORT_PROTOCOL_VERSION, max = TRANSPORT_PROTOCOL_VERSION))]
        v: u8,
        /// Correlation id echoed from the command.
        #[schemars(length(min = 1))]
        id: String,
        /// Response payload.
        response: Box<ConsumerResponse>,
    },
    /// Runtime event frame.
    Event {
        /// Transport protocol version.
        #[schemars(range(min = TRANSPORT_PROTOCOL_VERSION, max = TRANSPORT_PROTOCOL_VERSION))]
        v: u8,
        /// Event payload.
        event: RuntimeEvent,
    },
}
