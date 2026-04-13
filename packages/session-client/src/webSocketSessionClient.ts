import {
  CONDUIT_TRANSPORT_VERSION,
  createConsumerCommand,
} from "@conduit/session-contracts";
import { createDeferred } from "./deferred.js";
import { readSessionHistoryResponse } from "./historyWindow.js";
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
import { parseServerFrame } from "./wireFrame.js";
import { requireWebSocketUrl } from "./webSocketUrl.js";
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
  RuntimeEvent,
  ServerFrame,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
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
  private readonly options: SessionClientOptions;
  private readonly pending = new Map<
    string,
    PromiseWithResolvers<ConsumerResponse>
  >();
  private connecting: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;
  public constructor(options: SessionClientOptions = {}) {
    this.options = options;
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
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/open", provider, request),
    );
    return readSessionHistoryResponse(response);
  }
  public async readSessionHistory(
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/history", "all", request),
    );
    return readSessionHistoryResponse(response);
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
    const socket = await this.openSocket();
    const response = this.trackResponse(command.id);
    socket.send(
      JSON.stringify({
        v: CONDUIT_TRANSPORT_VERSION,
        type: "command",
        id: command.id,
        command,
      }),
    );
    return response;
  }
  private async openSocket(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket;
    }
    if (this.connecting) {
      const socket = await this.connecting;
      return socket;
    }
    this.connecting = this.connectSocket();
    const socket = await this.connecting;
    return socket;
  }
  private async connectSocket(): Promise<WebSocket> {
    const Socket = this.options.WebSocketImpl ?? WebSocket;
    const socket = new Socket(requireWebSocketUrl(this.options.url));
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      this.handleMessage(event);
    });
    socket.addEventListener("close", () => {
      this.handleClose();
    });
    const openedSocket = await this.waitForOpen(socket);
    return openedSocket;
  }
  private async waitForOpen(socket: WebSocket): Promise<WebSocket> {
    const deferred = createDeferred<WebSocket>();
    socket.addEventListener("open", () => {
      this.connecting = null;
      deferred.resolve(socket);
    });
    socket.addEventListener("error", () => {
      this.connecting = null;
      deferred.reject(new Error("session websocket failed to connect"));
    });
    const openedSocket = await deferred.promise;
    return openedSocket;
  }
  private async trackResponse(id: string): Promise<ConsumerResponse> {
    const deferred = createDeferred<ConsumerResponse>();
    this.pending.set(id, deferred);
    const response = await deferred.promise;
    return response;
  }
  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }
    const frame = parseServerFrame(event.data);
    if (!frame) {
      return;
    }
    this.handleServerFrame(frame);
  }
  private handleServerFrame(frame: ServerFrame): void {
    if (frame.type === "response") {
      this.pending.get(frame.id)?.resolve(frame.response);
      this.pending.delete(frame.id);
      return;
    }
    this.handleTimelineEvent(frame.event);
    this.handleSessionsIndexEvent(frame.event);
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
  private handleClose(): void {
    this.socket = null;
    this.connecting = null;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("session websocket closed"));
    }
    this.pending.clear();
  }
}
export { WebSocketSessionClient };
