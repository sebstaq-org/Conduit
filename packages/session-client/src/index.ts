import {
  CONDUIT_TRANSPORT_VERSION,
  createConsumerCommand,
} from "@conduit/session-contracts";
import type {
  ConsumerCommand,
  ConsumerResponse,
  RuntimeEvent,
  ServerFrame,
} from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";

interface SessionClientPort {
  readonly policy: "official-acp-only";
  dispatch(command: ConsumerCommand): Promise<ConsumerResponse>;
  initialize(provider: ProviderId): Promise<ConsumerResponse>;
  subscribe(
    provider: ProviderId,
    handler: (event: RuntimeEvent) => void,
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
  private readonly eventHandlers = new Set<(event: RuntimeEvent) => void>();
  private readonly options: SessionClientOptions;
  private readonly pending = new Map<string, PendingResponse>();
  private connecting: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;

  public constructor(options: SessionClientOptions = {}) {
    this.options = options;
  }

  public async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
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

  public async initialize(provider: ProviderId): Promise<ConsumerResponse> {
    const response = await this.dispatch(
      createConsumerCommand("initialize", provider),
    );
    return response;
  }

  public async subscribe(
    provider: ProviderId,
    handler: (event: RuntimeEvent) => void,
    afterSequence: number | null = null,
  ): Promise<() => void> {
    this.eventHandlers.add(handler);
    const response = await this.dispatch(
      createConsumerCommand("events/subscribe", provider, {
        after_sequence: afterSequence,
      }),
    );
    if (!response.ok) {
      this.eventHandlers.delete(handler);
      throw new Error(response.error?.message ?? "event subscription failed");
    }
    return () => {
      this.eventHandlers.delete(handler);
    };
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
    for (const handler of this.eventHandlers) {
      handler(frame.event);
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

export {
  CONDUIT_COMMANDS,
  CONDUIT_TRANSPORT_VERSION,
  CONSUMER_COMMANDS,
  SESSION_COMMANDS,
  createConsumerCommand,
} from "@conduit/session-contracts";
export {
  PROVIDER_CATALOG,
  PROVIDERS,
  createLiveSessionIdentity,
  getProviderDescriptor,
} from "@conduit/session-model";
export { WebSocketSessionClient, createSessionClient };

export type {
  ClientCommandFrame,
  ConduitCommandName,
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerError,
  ConsumerResponse,
  RuntimeEvent,
  RuntimeEventKind,
  ServerEventFrame,
  ServerFrame,
  ServerResponseFrame,
  SessionCommandName,
} from "@conduit/session-contracts";
export type {
  ConnectionState,
  LiveSessionIdentity,
  LiveSessionSnapshot,
  PromptLifecycleSnapshot,
  PromptLifecycleState,
  ProviderDescriptor,
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
} from "@conduit/session-model";
export type { SessionClientOptions, SessionClientPort };
