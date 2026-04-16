import { createConsumerCommand } from "@conduit/session-contracts";
import {
  readProvidersConfigSnapshotResponse,
  readSessionHistoryResponse,
  readSessionNewResponse,
  readSessionOpenResponse,
  readSessionSetConfigOptionResponse,
} from "./historyWindow.js";
import {
  readGlobalSettingsResponse,
  readProjectListResponse,
  readProjectSuggestionsResponse,
} from "./projectViews.js";
import { readSessionGroupsResponse } from "./sessionGroupsView.js";
import type {
  SessionClientOptions,
  SessionClientPort,
} from "./sessionClientPort.js";
import {
  readSessionTimelineChanged,
  readSessionsIndexChanged,
} from "./timelineEvent.js";
import { WebSocketTransport } from "./transport/webSocketTransport.js";
import type {
  ConsumerCommand,
  ConsumerResponse,
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  ProvidersConfigSnapshotResult,
  RuntimeEvent,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionNewRequest,
  SessionNewResult,
  SessionOpenResult,
  SessionOpenRequest,
  SessionPromptRequest,
  SessionRespondInteractionRequest,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
} from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";
import type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";

class WebSocketSessionClient implements SessionClientPort {
  public readonly policy = "official-acp-only";
  private readonly timelineSubscriptions = new Set<{
    openSessionId: string;
    handler: (event: SessionTimelineChanged) => void;
  }>();
  private readonly sessionIndexSubscriptions = new Set<{
    handler: (event: SessionsIndexChanged) => void;
  }>();
  private readonly transport: WebSocketTransport;
  public constructor(options: SessionClientOptions = {}) {
    this.transport = new WebSocketTransport(options, (event) => {
      this.handleRuntimeEvent(event);
    });
  }
  public async listProjects(): Promise<ProjectListView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/list", "all"),
    );
    return readProjectListResponse(response, "projects list failed");
  }
  public async addProject(
    request: ProjectAddRequest,
  ): Promise<ProjectListView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/add", "all", request),
    );
    return readProjectListResponse(response, "project add failed");
  }
  public async removeProject(
    request: ProjectRemoveRequest,
  ): Promise<ProjectListView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/remove", "all", request),
    );
    return readProjectListResponse(response, "project remove failed");
  }
  public async getProjectSuggestions(
    query: ProjectSuggestionsQuery = {},
  ): Promise<ProjectSuggestionsView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/suggestions", "all", query),
    );
    return readProjectSuggestionsResponse(response);
  }
  public async updateProject(
    request: ProjectUpdateRequest,
  ): Promise<ProjectListView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/update", "all", request),
    );
    return readProjectListResponse(response, "project update failed");
  }
  public async getSessionGroups(
    query: SessionGroupsQuery = {},
  ): Promise<SessionGroupsView> {
    const response = await this.dispatch(
      createConsumerCommand("sessions/grouped", "all", query),
    );
    return readSessionGroupsResponse(response);
  }
  public async getProvidersConfigSnapshot(): Promise<ProvidersConfigSnapshotResult> {
    const response = await this.dispatch(
      createConsumerCommand("providers/config_snapshot", "all"),
    );
    const parsed = readProvidersConfigSnapshotResponse(response);
    if (!parsed.ok || parsed.result === null) {
      throw new Error(
        parsed.error?.message ?? "providers config snapshot failed",
      );
    }
    return parsed.result;
  }
  public async getSettings(): Promise<GlobalSettingsView> {
    const response = await this.dispatch(
      createConsumerCommand("settings/get", "all"),
    );
    return readGlobalSettingsResponse(response, "settings get failed");
  }
  public async updateSettings(
    request: GlobalSettingsUpdateRequest,
  ): Promise<GlobalSettingsView> {
    const response = await this.dispatch(
      createConsumerCommand("settings/update", "all", request),
    );
    return readGlobalSettingsResponse(response, "settings update failed");
  }
  public async openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionOpenResult | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/open", provider, request),
    );
    return readSessionOpenResponse(response);
  }
  public async newSession(
    provider: ProviderId,
    request: SessionNewRequest,
  ): Promise<ConsumerResponse<SessionNewResult | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/new", provider, request),
    );
    return readSessionNewResponse(response);
  }
  public async readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/history", "all", request),
    );
    return readSessionHistoryResponse(response);
  }
  public async setSessionConfigOption(
    provider: ProviderId,
    request: SessionSetConfigOptionRequest,
  ): Promise<ConsumerResponse<SessionSetConfigOptionResult | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/set_config_option", provider, request),
    );
    return readSessionSetConfigOptionResponse(response);
  }
  public async promptSession(request: SessionPromptRequest): Promise<void> {
    const response = await this.dispatch(
      createConsumerCommand("session/prompt", "all", request),
    );
    if (!response.ok) {
      throw new Error(response.error?.message ?? "session prompt failed");
    }
  }
  public async respondInteraction(
    request: SessionRespondInteractionRequest,
  ): Promise<void> {
    const response = await this.dispatch(
      createConsumerCommand("session/respond_interaction", "all", request),
    );
    if (!response.ok) {
      throw new Error(
        response.error?.message ?? "session respond_interaction failed",
      );
    }
  }
  public async subscribeTimelineChanges(
    openSessionId: string,
    handler: (event: SessionTimelineChanged) => void,
  ): Promise<() => void> {
    const subscription = { openSessionId, handler };
    this.timelineSubscriptions.add(subscription);
    const response = await this.dispatch(
      createConsumerCommand("session/watch", "all", { openSessionId }),
    );
    if (!response.ok) {
      this.timelineSubscriptions.delete(subscription);
      throw new Error(response.error?.message ?? "event subscription failed");
    }
    return () => {
      this.timelineSubscriptions.delete(subscription);
    };
  }
  public async subscribeSessionIndexChanges(
    handler: (event: SessionsIndexChanged) => void,
  ): Promise<() => void> {
    const subscription = { handler };
    this.sessionIndexSubscriptions.add(subscription);
    const response = await this.dispatch(
      createConsumerCommand("sessions/watch", "all"),
    );
    if (!response.ok) {
      this.sessionIndexSubscriptions.delete(subscription);
      throw new Error(response.error?.message ?? "event subscription failed");
    }
    return () => {
      this.sessionIndexSubscriptions.delete(subscription);
    };
  }
  private async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    const response = await this.transport.dispatch(command);
    return response;
  }
  private handleRuntimeEvent(event: RuntimeEvent): void {
    this.handleTimelineEvent(event);
    this.handleSessionsIndexEvent(event);
  }
  private handleTimelineEvent(eventFrame: RuntimeEvent): void {
    const event = readSessionTimelineChanged(eventFrame);
    if (event) {
      for (const subscription of this.timelineSubscriptions) {
        if (subscription.openSessionId === event.openSessionId) {
          subscription.handler(event);
        }
      }
    }
  }
  private handleSessionsIndexEvent(eventFrame: RuntimeEvent): void {
    const event = readSessionsIndexChanged(eventFrame);
    if (event) {
      for (const subscription of this.sessionIndexSubscriptions) {
        subscription.handler(event);
      }
    }
  }
}
export { WebSocketSessionClient };
