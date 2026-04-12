import {
  CONDUIT_TRANSPORT_VERSION,
  createConsumerCommand,
} from "@conduit/session-contracts";
import {
  ProjectListViewSchema,
  SessionGroupsViewSchema,
} from "@conduit/session-model";
import { readSessionHistoryResponse } from "./historyWindow.js";
import type {
  SessionClientOptions,
  SessionClientPort,
} from "./sessionClientPort.js";
import {
  readSessionTimelineChanged,
  readSessionsIndexChanged,
} from "./timelineEvent.js";
import { parseServerFrame } from "./wireFrame.js";
import type {
  ConsumerCommand,
  ConsumerResponse,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  RuntimeEvent,
  ServerFrame,
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

interface TimelineSubscription {
  openSessionId: string;
  handler: (event: SessionTimelineChanged) => void;
}

interface SessionIndexSubscription {
  handler: (event: SessionsIndexChanged) => void;
}

class WebSocketSessionClient implements SessionClientPort {
  public readonly policy = "official-acp-only";
  private readonly timelineSubscriptions = new Set<TimelineSubscription>();
  private readonly sessionIndexSubscriptions =
    new Set<SessionIndexSubscription>();
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
    if (!response.ok) {
      throw new Error(response.error?.message ?? "projects list failed");
    }
    return ProjectListViewSchema.parse(response.result);
  }

  public async addProject(
    request: ProjectAddRequest,
  ): Promise<ProjectListView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/add", "all", request),
    );
    if (!response.ok) {
      throw new Error(response.error?.message ?? "project add failed");
    }
    return ProjectListViewSchema.parse(response.result);
  }

  public async removeProject(
    request: ProjectRemoveRequest,
  ): Promise<ProjectListView> {
    const response = await this.dispatch(
      createConsumerCommand("projects/remove", "all", request),
    );
    if (!response.ok) {
      throw new Error(response.error?.message ?? "project remove failed");
    }
    return ProjectListViewSchema.parse(response.result);
  }

  public async getSessionGroups(
    query: SessionGroupsQuery = {},
  ): Promise<SessionGroupsView> {
    const response = await this.dispatch(
      createConsumerCommand("sessions/grouped", "all", query),
    );
    if (!response.ok) {
      throw new Error(
        response.error?.message ?? "session groups request failed",
      );
    }
    return SessionGroupsViewSchema.parse(response.result);
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
    const socket = new Socket(this.url());
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
    const deferred = Promise.withResolvers<WebSocket>();
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
    const deferred = Promise.withResolvers<ConsumerResponse>();
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

  private url(): string {
    return this.options.url ?? "ws://127.0.0.1:4174/api/session";
  }
}

const createSessionClient = (
  options?: SessionClientOptions,
): SessionClientPort => new WebSocketSessionClient(options);

export { WebSocketSessionClient, createSessionClient };
