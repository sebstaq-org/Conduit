import type {
  ServerFrame,
  ConsumerCommand,
  ConsumerResponse,
  RuntimeEvent,
} from "@conduit/session-contracts";
import {
  CONDUIT_TRANSPORT_VERSION,
  createConsumerCommand,
} from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";

export * from "@conduit/session-contracts";
export * from "@conduit/session-model";

export interface SessionClientPort {
  readonly policy: "official-acp-only";
  dispatch(command: ConsumerCommand): Promise<ConsumerResponse>;
  initialize(provider: ProviderId): Promise<ConsumerResponse>;
  subscribe(
    provider: ProviderId,
    handler: (event: RuntimeEvent) => void,
    afterSequence?: number | null,
  ): Promise<() => void>;
}

export interface SessionClientOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
}

type PendingResponse = {
  resolve: (response: ConsumerResponse) => void;
  reject: (error: Error) => void;
};

export class WebSocketSessionClient implements SessionClientPort {
  public readonly policy = "official-acp-only";
  private readonly pending = new Map<string, PendingResponse>();
  private readonly eventHandlers = new Set<(event: RuntimeEvent) => void>();
  private socket: WebSocket | null = null;
  private connecting: Promise<WebSocket> | null = null;

  public constructor(private readonly options: SessionClientOptions = {}) {}

  public async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    const socket = await this.openSocket();
    const response = new Promise<ConsumerResponse>((resolve, reject) => {
      this.pending.set(command.id, { resolve, reject });
    });
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

  public initialize(provider: ProviderId): Promise<ConsumerResponse> {
    return this.dispatch(createConsumerCommand("initialize", provider));
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

  private openSocket(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.socket);
    }
    if (this.connecting) {
      return this.connecting;
    }
    this.connecting = this.connectSocket();
    return this.connecting;
  }

  private connectSocket(): Promise<WebSocket> {
    const Socket = this.options.WebSocketImpl ?? WebSocket;
    const socket = new Socket(this.url());
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      this.handleMessage(event);
    });
    socket.addEventListener("close", () => {
      this.handleClose();
    });
    return new Promise((resolve, reject) => {
      socket.addEventListener("open", () => {
        this.connecting = null;
        resolve(socket);
      });
      socket.addEventListener("error", () => {
        this.connecting = null;
        reject(new Error("session websocket failed to connect"));
      });
    });
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }
    const frame = parseServerFrame(event.data);
    if (!frame) {
      return;
    }
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

export function createSessionClient(
  options?: SessionClientOptions,
): SessionClientPort {
  return new WebSocketSessionClient(options);
}

function parseServerFrame(text: string): ServerFrame | null {
  const parsed: unknown = JSON.parse(text);
  if (!isServerFrame(parsed)) {
    return null;
  }
  return parsed;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
