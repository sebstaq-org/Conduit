export { createSessionClient } from "./createSessionClient.js";
export { WebSocketSessionClient } from "./webSocketSessionClient.js";
export { PROVIDERS } from "@conduit/session-model";

export type {
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectRow,
  ProjectSuggestion,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionNewRequest,
  SessionNewResult,
  SessionOpenResult,
  SessionOpenRequest,
  SessionPromptRequest,
  SessionRespondInteractionRequest,
  ProvidersConfigSnapshotResult,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
} from "@conduit/session-contracts";
export type {
  ContentBlock,
  ProviderId,
  SessionConfigOption,
  SessionGroupsQuery,
  SessionGroupsView,
  TranscriptEventItem,
  TranscriptItem,
} from "@conduit/session-model";
export type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";
export type {
  SessionClientOptions,
  SessionClientPort,
} from "./sessionClientPort.js";
