import {
  ClientCommandFrameSchema,
  type ConsumerCommand,
  type ConsumerResponse,
  type RuntimeEvent,
  type ServerFrame,
} from "@conduit/app-protocol";
import { createDeferred } from "./deferred.js";
import { parseServerFrame } from "./wireFrame.js";
import type { SessionClientTelemetryEvent } from "./sessionClientTelemetryEvent.js";
import { requireWebSocketUrl } from "./webSocketUrl.js";

interface WebSocketTransportOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
  onTelemetryEvent?: (event: SessionClientTelemetryEvent) => void;
}

class WebSocketTransport {
  private readonly handleEvent: (event: RuntimeEvent) => void;
  private readonly options: WebSocketTransportOptions;
  private readonly pending = new Map<
    string,
    PromiseWithResolvers<ConsumerResponse>
  >();
  private connecting: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;

  public constructor(
    options: WebSocketTransportOptions,
    handleEvent: (event: RuntimeEvent) => void,
  ) {
    this.options = options;
    this.handleEvent = handleEvent;
  }

  public async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    const startedAt = Date.now();
    this.logDispatchStart(command);
    const responseDeferred = await this.sendCommand(command, startedAt);
    return this.awaitDispatchResponse(command, responseDeferred, startedAt);
  }

  private logDispatchStart(command: ConsumerCommand): void {
    this.emitTelemetry({
      event_name: "session_client.transport.dispatch.start",
      fields: { command },
      level: "debug",
    });
  }

  private sendCommandFailure(
    command: ConsumerCommand,
    startedAt: number,
    error: unknown,
  ): void {
    this.emitTelemetry({
      event_name: "session_client.transport.dispatch.finish",
      fields: {
        command,
        duration_ms: Date.now() - startedAt,
        error,
        error_code: "socket_send_failed",
        ok: false,
      },
      level: "warn",
    });
  }

  private dispatchFailure(
    command: ConsumerCommand,
    startedAt: number,
    error: unknown,
  ): void {
    this.emitTelemetry({
      event_name: "session_client.transport.dispatch.finish",
      fields: {
        command,
        duration_ms: Date.now() - startedAt,
        error,
        error_code: "dispatch_failed",
        ok: false,
      },
      level: "warn",
    });
  }

  private dispatchSuccess(
    command: ConsumerCommand,
    startedAt: number,
    response: ConsumerResponse,
  ): void {
    this.emitTelemetry({
      event_name: "session_client.transport.dispatch.finish",
      fields: {
        command,
        duration_ms: Date.now() - startedAt,
        ok: true,
        response,
      },
      level: "info",
    });
  }

  private async sendCommand(
    command: ConsumerCommand,
    startedAt: number,
  ): Promise<PromiseWithResolvers<ConsumerResponse>> {
    const socket = await this.openSocket();
    const responseDeferred = this.trackResponse(command.id);
    try {
      const frame = ClientCommandFrameSchema.parse({
        v: 1,
        type: "command",
        id: command.id,
        command,
      });
      socket.send(JSON.stringify(frame));
      return responseDeferred;
    } catch (error) {
      this.pending.delete(command.id);
      responseDeferred.reject(new Error("session websocket send failed"));
      this.sendCommandFailure(command, startedAt, error);
      throw error;
    }
  }

  private async awaitDispatchResponse(
    command: ConsumerCommand,
    responseDeferred: PromiseWithResolvers<ConsumerResponse>,
    startedAt: number,
  ): Promise<ConsumerResponse> {
    try {
      const response = await responseDeferred.promise;
      this.dispatchSuccess(command, startedAt, response);
      return response;
    } catch (error) {
      this.dispatchFailure(command, startedAt, error);
      throw error;
    }
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
    const wsUrl = requireWebSocketUrl(this.options.url);
    this.emitTelemetry({
      event_name: "session_client.transport.socket.connect.start",
      fields: { ws_url: wsUrl },
      level: "debug",
    });
    const socket = new Socket(wsUrl);
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
      this.emitTelemetry({
        event_name: "session_client.transport.socket.connect.finish",
        fields: { ok: true },
        level: "info",
      });
      deferred.resolve(socket);
    });
    socket.addEventListener("error", (event) => {
      this.connecting = null;
      this.emitTelemetry({
        event_name: "session_client.transport.socket.connect.finish",
        fields: {
          error: event,
          error_code: "socket_connect_failed",
          ok: false,
        },
        level: "warn",
      });
      deferred.reject(new Error("session websocket failed to connect"));
    });
    const openedSocket = await deferred.promise;
    return openedSocket;
  }

  private trackResponse(id: string): PromiseWithResolvers<ConsumerResponse> {
    const deferred = createDeferred<ConsumerResponse>();
    this.pending.set(id, deferred);
    return deferred;
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }
    const frame = parseServerFrame(event.data);
    if (!frame) {
      this.emitTelemetry({
        event_name: "session_client.transport.message.parse_failed",
        fields: {
          error_code: "invalid_server_frame",
          frame_text: event.data,
          ok: false,
        },
        level: "warn",
      });
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
    this.handleEvent(frame.event);
  }

  private handleClose(): void {
    const pendingCount = this.pending.size;
    this.socket = null;
    this.connecting = null;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("session websocket closed"));
    }
    this.pending.clear();
    this.emitTelemetry({
      event_name: "session_client.transport.socket.closed",
      fields: { pending_count: pendingCount },
      level: "warn",
    });
  }

  private emitTelemetry(event: SessionClientTelemetryEvent): void {
    this.options.onTelemetryEvent?.(event);
  }
}

export { WebSocketTransport };
