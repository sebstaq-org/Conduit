import type {
  ConsumerResponse,
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
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
  ProvidersConfigSnapshotResult,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
} from "@conduit/session-contracts";
import type {
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
} from "@conduit/session-model";
import type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";

interface SessionClientPort {
  readonly policy: "official-acp-only";
  addProject(request: ProjectAddRequest): Promise<ProjectListView>;
  getProjectSuggestions(
    query?: ProjectSuggestionsQuery,
  ): Promise<ProjectSuggestionsView>;
  getSettings(): Promise<GlobalSettingsView>;
  getSessionGroups(query?: SessionGroupsQuery): Promise<SessionGroupsView>;
  getProvidersConfigSnapshot(): Promise<ProvidersConfigSnapshotResult>;
  listProjects(): Promise<ProjectListView>;
  openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionOpenResult | null>>;
  newSession(
    provider: ProviderId,
    request: SessionNewRequest,
  ): Promise<ConsumerResponse<SessionNewResult | null>>;
  setSessionConfigOption(
    provider: ProviderId,
    request: SessionSetConfigOptionRequest,
  ): Promise<ConsumerResponse<SessionSetConfigOptionResult | null>>;
  readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
  promptSession(request: SessionPromptRequest): Promise<void>;
  removeProject(request: ProjectRemoveRequest): Promise<ProjectListView>;
  updateProject(request: ProjectUpdateRequest): Promise<ProjectListView>;
  updateSettings(
    request: GlobalSettingsUpdateRequest,
  ): Promise<GlobalSettingsView>;
  subscribeTimelineChanges(
    openSessionId: string,
    handler: (event: SessionTimelineChanged) => void,
  ): Promise<() => void>;
  subscribeSessionIndexChanges(
    handler: (event: SessionsIndexChanged) => void,
  ): Promise<() => void>;
}

interface SessionClientTelemetryEvent {
  event_name: string;
  level: "debug" | "info" | "warn" | "error";
  fields?: Record<string, unknown>;
}

interface SessionClientOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
  onTelemetryEvent?: (event: SessionClientTelemetryEvent) => void;
}

export type {
  SessionClientOptions,
  SessionClientPort,
  SessionClientTelemetryEvent,
};
