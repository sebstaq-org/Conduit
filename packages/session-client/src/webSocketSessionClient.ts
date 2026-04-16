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
  ProviderId,
  ProvidersConfigSnapshotResult,
  RuntimeEvent,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionNewRequest,
  SessionNewResult,
  SessionOpenRequest,
  SessionOpenResult,
  SessionPromptRequest,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
} from "@conduit/app-protocol";
import { createConsumerCommand } from "./consumerCommand.js";
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
    return readProjectListResponse(
      await this.dispatch(createConsumerCommand("projects/list", "all", {})),
      "projects list failed",
    );
  }

  public async addProject(
    request: ProjectAddRequest,
  ): Promise<ProjectListView> {
    return readProjectListResponse(
      await this.dispatch(
        createConsumerCommand("projects/add", "all", request),
      ),
      "project add failed",
    );
  }

  public async removeProject(
    request: ProjectRemoveRequest,
  ): Promise<ProjectListView> {
    return readProjectListResponse(
      await this.dispatch(
        createConsumerCommand("projects/remove", "all", request),
      ),
      "project remove failed",
    );
  }

  public async getProjectSuggestions(
    query: ProjectSuggestionsQuery = {},
  ): Promise<ProjectSuggestionsView> {
    return readProjectSuggestionsResponse(
      await this.dispatch(
        createConsumerCommand("projects/suggestions", "all", query),
      ),
    );
  }

  public async updateProject(
    request: ProjectUpdateRequest,
  ): Promise<ProjectListView> {
    return readProjectListResponse(
      await this.dispatch(
        createConsumerCommand("projects/update", "all", request),
      ),
      "project update failed",
    );
  }

  public async getSessionGroups(
    query: SessionGroupsQuery = {},
  ): Promise<SessionGroupsView> {
    return readSessionGroupsResponse(
      await this.dispatch(
        createConsumerCommand("sessions/grouped", "all", query),
      ),
    );
  }

  public async getProvidersConfigSnapshot(): Promise<ProvidersConfigSnapshotResult> {
    return readProvidersConfigSnapshotResponse(
      await this.dispatch(
        createConsumerCommand("providers/config_snapshot", "all", {}),
      ),
    );
  }

  public async getSettings(): Promise<GlobalSettingsView> {
    return readGlobalSettingsResponse(
      await this.dispatch(createConsumerCommand("settings/get", "all", {})),
      "settings get failed",
    );
  }

  public async updateSettings(
    request: GlobalSettingsUpdateRequest,
  ): Promise<GlobalSettingsView> {
    return readGlobalSettingsResponse(
      await this.dispatch(
        createConsumerCommand("settings/update", "all", request),
      ),
      "settings update failed",
    );
  }

  public async openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<SessionOpenResult> {
    return readSessionOpenResponse(
      await this.dispatch(
        createConsumerCommand("session/open", provider, request),
      ),
    );
  }

  public async newSession(
    provider: ProviderId,
    request: SessionNewRequest,
  ): Promise<SessionNewResult> {
    return readSessionNewResponse(
      await this.dispatch(
        createConsumerCommand("session/new", provider, request),
      ),
    );
  }

  public async readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<SessionHistoryWindow> {
    return readSessionHistoryResponse(
      await this.dispatch(
        createConsumerCommand("session/history", "all", request),
      ),
    );
  }

  public async setSessionConfigOption(
    provider: ProviderId,
    request: SessionSetConfigOptionRequest,
  ): Promise<SessionSetConfigOptionResult> {
    return readSessionSetConfigOptionResponse(
      await this.dispatch(
        createConsumerCommand("session/set_config_option", provider, request),
      ),
    );
  }

  public async promptSession(request: SessionPromptRequest): Promise<void> {
    const response = await this.dispatch(
      createConsumerCommand("session/prompt", "all", request),
    );
    if (!response.ok) {
      throw new Error(response.error?.message ?? "session prompt failed");
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
      createConsumerCommand("sessions/watch", "all", {}),
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
