import {
  CONDUIT_TRANSPORT_VERSION,
  createConsumerCommand,
} from "@conduit/session-contracts";
import { readSessionHistoryResponse } from "./historyWindow.js";
import {
  readSessionTimelineChanged,
  readSessionsIndexChanged,
} from "./timelineEvent.js";
import type {
  ConsumerCommand,
  ConsumerResponse,
  RuntimeEvent,
  ServerFrame,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-contracts";
import type { SessionTimelineChanged } from "./timelineEvent.js";
import type { SessionsIndexChanged } from "./timelineEvent.js";
import { SessionGroupsViewSchema } from "@conduit/session-model";
import type {
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
} from "@conduit/session-model";

interface SessionClientPort {
  readonly policy: "official-acp-only";
  getSessionGroups(query?: SessionGroupsQuery): Promise<SessionGroupsView>;
  openSession(
    provider: ProviderId,
    request: SessionOpenRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
  readSessionHistory(
    provider: ProviderId,
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>>;
  promptSession(
    provider: ProviderId,
    request: SessionPromptRequest,
  ): Promise<void>;
  subscribeTimelineChanges(
    provider: ProviderId,
    handler: (event: SessionTimelineChanged) => void,
    afterSequence?: number | null,
  ): Promise<() => void>;
  subscribeSessionIndexChanges(
    provider: ProviderId,
    handler: (event: SessionsIndexChanged) => void,
    afterSequence?: number | null,
  ): Promise<() => void>;
}

interface SessionClientOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
}

interface PendingResponse {
  resolve: (response: ConsumerResponse) => void;
  reject: (error: Error) => void;
}

interface TimelineSubscription {
  provider: ProviderId;
  handler: (event: SessionTimelineChanged) => void;
}

interface SessionIndexSubscription {
  handler: (event: SessionsIndexChanged) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isServerFrame(value: unknown): value is ServerFrame {
  if (!isRecord(value) || value.v !== CONDUIT_TRANSPORT_VERSION) {
    return false;
  }
  if (value.type === "response") {
    return typeof value.id === "string" && isRecord(value.response);
  }
  return value.type === "event" && isRecord(value.event);
}

function parseServerFrame(text: string): ServerFrame | null {
  const parsed: unknown = JSON.parse(text);
  if (!isServerFrame(parsed)) {
    return null;
  }
  return parsed;
}

class WebSocketSessionClient implements SessionClientPort {
  public readonly policy = "official-acp-only";
  private readonly timelineSubscriptions = new Set<TimelineSubscription>();
  private readonly sessionIndexSubscriptions =
    new Set<SessionIndexSubscription>();
  private readonly options: SessionClientOptions;
  private readonly pending = new Map<string, PendingResponse>();
  private connecting: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;

  public constructor(options: SessionClientOptions = {}) {
    this.options = options;
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
    provider: ProviderId,
    request: SessionHistoryRequest,
  ): Promise<ConsumerResponse<SessionHistoryWindow | null>> {
    const response = await this.dispatch(
      createConsumerCommand("session/history", provider, request),
    );
    return readSessionHistoryResponse(response);
  }

  public async promptSession(
    provider: ProviderId,
    request: SessionPromptRequest,
  ): Promise<void> {
    const response = await this.dispatch(
      createConsumerCommand("session/prompt", provider, request),
    );
    if (!response.ok) {
      throw new Error(response.error?.message ?? "session prompt failed");
    }
  }

  public async subscribeTimelineChanges(
    provider: ProviderId,
    handler: (event: SessionTimelineChanged) => void,
    afterSequence: number | null = null,
  ): Promise<() => void> {
    const subscription = { provider, handler };
    this.timelineSubscriptions.add(subscription);
    const response = await this.dispatch(
      createConsumerCommand("events/subscribe", provider, {
        after_sequence: afterSequence,
      }),
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
    provider: ProviderId,
    handler: (event: SessionsIndexChanged) => void,
    afterSequence: number | null = null,
  ): Promise<() => void> {
    const subscription = { handler };
    this.sessionIndexSubscriptions.add(subscription);
    const response = await this.dispatch(
      createConsumerCommand("events/subscribe", provider, {
        after_sequence: afterSequence,
      }),
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
    const openedSocket = await new Promise<WebSocket>((resolve, reject) => {
      socket.addEventListener("open", () => {
        this.connecting = null;
        resolve(socket);
      });
      socket.addEventListener("error", () => {
        this.connecting = null;
        reject(new Error("session websocket failed to connect"));
      });
    });
    return openedSocket;
  }

  private async trackResponse(id: string): Promise<ConsumerResponse> {
    const response = await new Promise<ConsumerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
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
        if (subscription.provider === event.provider) {
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

function createSessionClient(
  options?: SessionClientOptions,
): SessionClientPort {
  return new WebSocketSessionClient(options);
}

export { createSessionClient };
export { PROVIDERS } from "@conduit/session-model";

export type {
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-contracts";
export type {
  ContentBlock,
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
  TranscriptEventItem,
  TranscriptItem,
} from "@conduit/session-model";
export type {
  SessionTimelineChanged,
  SessionsIndexChanged,
} from "./timelineEvent.js";
export type { SessionClientOptions, SessionClientPort };
