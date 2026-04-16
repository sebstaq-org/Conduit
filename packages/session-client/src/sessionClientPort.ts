import type {
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
  ProviderId,
  ProvidersConfigSnapshotResult,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
} from "@conduit/app-protocol";
import type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";
import type { SessionClientTelemetryEvent } from "./transport/sessionClientTelemetryEvent.js";

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
  ): Promise<SessionOpenResult>;
  newSession(
    provider: ProviderId,
    request: SessionNewRequest,
  ): Promise<SessionNewResult>;
  setSessionConfigOption(
    provider: ProviderId,
    request: SessionSetConfigOptionRequest,
  ): Promise<SessionSetConfigOptionResult>;
  readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<SessionHistoryWindow>;
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
