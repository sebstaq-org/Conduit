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
  SessionOpenRequest,
  SessionPromptRequest,
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
  listProjects(): Promise<ProjectListView>;
  openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
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

interface SessionClientOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
}

export type { SessionClientOptions, SessionClientPort };
