import { CONDUIT_TRANSPORT_VERSION } from "@conduit/session-contracts";
import { createRelayClientHandshake } from "@conduit/relay-transport";
import { createDeferred } from "./deferred.js";
import { readRelayCipherFrame } from "./relayCipherFrame.js";
import { relaySocketRoute } from "./relayRoute.js";
import { parseServerFrame } from "./wireFrame.js";
import type {
  RelayCipherChannel,
  RelayCipherFrame,
} from "@conduit/relay-transport";
import type { ConduitRuntimeEvent } from "@conduit/app-protocol";
import type { CommandTransport } from "./commandTransport.js";
import type { SessionClientTelemetryEvent } from "./sessionClientTelemetryEvent.js";
import type { ParsedServerFrame } from "./wireFrame.js";
import type {
  ConsumerCommand,
  ConsumerResponse,
} from "@conduit/session-contracts";

const transportVersionField = "v";

interface RelayConnectionOffer {
  readonly daemonPublicKeyB64: string;
  readonly nonce: string;
  readonly relay: {
    readonly endpoint: string;
    readonly serverId: string;
    readonly clientCapability: string;
  };
}

interface RelaySessionClientOptions {
  readonly offer: RelayConnectionOffer;
  readonly WebSocketImpl?: typeof WebSocket;
  readonly onTelemetryEvent?: (event: SessionClientTelemetryEvent) => void;
}

class RelayWebSocketTransport implements CommandTransport {
  private readonly handleEvent: (event: ConduitRuntimeEvent) => void;
  private readonly options: RelaySessionClientOptions;
  private readonly pending = new Map<
    string,
    PromiseWithResolvers<ConsumerResponse>
  >();
  private channel: RelayCipherChannel | null = null;
  private connecting: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;

  public constructor(
    options: RelaySessionClientOptions,
    handleEvent: (event: ConduitRuntimeEvent) => void,
  ) {
    this.options = options;
    this.handleEvent = handleEvent;
  }

  public async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    const startedAt = Date.now();
    this.emitTelemetry({
      event_name: "session_client.relay.dispatch.start",
      fields: { command },
      level: "debug",
    });
    const responseDeferred = await this.sendCommand(command);
    try {
      const response = await responseDeferred.promise;
      this.emitTelemetry({
        event_name: "session_client.relay.dispatch.finish",
        fields: { command, duration_ms: Date.now() - startedAt, ok: true },
        level: "info",
      });
      return response;
    } catch (error) {
      this.emitTelemetry({
        event_name: "session_client.relay.dispatch.finish",
        fields: {
          command,
          duration_ms: Date.now() - startedAt,
          error,
          error_code: "dispatch_failed",
          ok: false,
        },
        level: "warn",
      });
      throw error;
    }
  }

  private async sendCommand(
    command: ConsumerCommand,
  ): Promise<PromiseWithResolvers<ConsumerResponse>> {
    const socket = await this.openSocket();
    const responseDeferred = this.trackResponse(command.id);
    const encrypted = await this.encryptCommand(command);
    try {
      socket.send(JSON.stringify(encrypted));
      return responseDeferred;
    } catch (error) {
      this.pending.delete(command.id);
      responseDeferred.reject(new Error("relay websocket send failed"));
      this.emitTelemetry({
        event_name: "session_client.relay.send_failed",
        fields: { command, error, ok: false },
        level: "warn",
      });
      throw error;
    }
  }

  private async encryptCommand(
    command: ConsumerCommand,
  ): Promise<RelayCipherFrame> {
    const frame = JSON.stringify({
      [transportVersionField]: CONDUIT_TRANSPORT_VERSION,
      type: "command",
      id: command.id,
      command,
    });
    const encrypted = await this.requireChannel().encryptUtf8(frame);
    return encrypted;
  }

  private async openSocket(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN && this.channel !== null) {
      return this.socket;
    }
    if (this.connecting) {
      const connectingSocket = await this.connecting;
      return connectingSocket;
    }
    this.connecting = this.connectSocket();
    const socket = await this.connecting;
    return socket;
  }

  private async connectSocket(): Promise<WebSocket> {
    const Socket = this.options.WebSocketImpl ?? WebSocket;
    const route = relaySocketRoute(this.options.offer);
    this.logConnectStart();
    const socket = new Socket(route.url, [route.protocol]);
    this.socket = socket;
    this.bindSocketEvents(socket);
    try {
      const openedSocket = await this.waitForOpen(socket);
      await this.sendHandshake(openedSocket, route.connectionId);
      this.connecting = null;
      return openedSocket;
    } catch (error) {
      this.connecting = null;
      socket.close();
      throw error;
    }
  }

  private bindSocketEvents(socket: WebSocket): void {
    socket.addEventListener("message", (event: MessageEvent) => {
      void this.handleMessage(event);
    });
    socket.addEventListener("close", () => {
      this.handleClose();
    });
  }

  private logConnectStart(): void {
    this.emitTelemetry({
      event_name: "session_client.relay.socket.connect.start",
      fields: { relay_server_id: this.options.offer.relay.serverId },
      level: "debug",
    });
  }

  private async sendHandshake(
    socket: WebSocket,
    connectionId: string,
  ): Promise<void> {
    const offer = this.options.offer;
    const handshake = await createRelayClientHandshake({
      context: {
        connectionId,
        offerNonce: offer.nonce,
        serverId: offer.relay.serverId,
      },
      daemonPublicKeyB64: offer.daemonPublicKeyB64,
    });
    this.channel = handshake.channel;
    socket.send(JSON.stringify(handshake.handshake));
  }

  private async waitForOpen(socket: WebSocket): Promise<WebSocket> {
    const deferred = createDeferred<WebSocket>();
    socket.addEventListener("open", () => {
      this.emitTelemetry({
        event_name: "session_client.relay.socket.connect.finish",
        fields: { ok: true },
        level: "info",
      });
      deferred.resolve(socket);
    });
    socket.addEventListener("error", (event) => {
      this.connecting = null;
      this.emitTelemetry({
        event_name: "session_client.relay.socket.connect.finish",
        fields: {
          error: event,
          error_code: "socket_connect_failed",
          ok: false,
        },
        level: "warn",
      });
      deferred.reject(new Error("relay websocket failed to connect"));
    });
    const openedSocket = await deferred.promise;
    return openedSocket;
  }

  private trackResponse(id: string): PromiseWithResolvers<ConsumerResponse> {
    const deferred = createDeferred<ConsumerResponse>();
    this.pending.set(id, deferred);
    return deferred;
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    if (typeof event.data !== "string") {
      return;
    }
    try {
      await this.handleEncryptedMessage(event.data);
    } catch (error) {
      this.closeAfterMessageFailure(error);
    }
  }

  private async handleEncryptedMessage(data: string): Promise<void> {
    const frame = readRelayCipherFrame(JSON.parse(data));
    const plaintext = await this.requireChannel().decryptUtf8(frame);
    const parsed = parseServerFrame(plaintext);
    if (!parsed) {
      this.emitTelemetry({
        event_name: "session_client.relay.message.parse_failed",
        fields: { error_code: "invalid_server_frame", ok: false },
        level: "warn",
      });
      return;
    }
    this.handleServerFrame(parsed);
  }

  private closeAfterMessageFailure(error: unknown): void {
    this.emitTelemetry({
      event_name: "session_client.relay.message.decrypt_failed",
      fields: { error, error_code: "relay_decrypt_failed", ok: false },
      level: "warn",
    });
    this.socket?.close();
  }

  private handleServerFrame(frame: ParsedServerFrame): void {
    if (frame.type === "response") {
      this.pending.get(frame.id)?.resolve(frame.response);
      this.pending.delete(frame.id);
      return;
    }
    this.handleEvent(frame.event);
  }

  private handleClose(): void {
    const pendingCount = this.pending.size;
    this.channel = null;
    this.socket = null;
    this.connecting = null;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("relay websocket closed"));
    }
    this.pending.clear();
    this.emitTelemetry({
      event_name: "session_client.relay.socket.closed",
      fields: { pending_count: pendingCount },
      level: "warn",
    });
  }

  private requireChannel(): RelayCipherChannel {
    if (this.channel === null) {
      throw new Error("relay cipher channel is not established");
    }
    return this.channel;
  }

  private emitTelemetry(event: SessionClientTelemetryEvent): void {
    this.options.onTelemetryEvent?.(event);
  }
}

export { RelayWebSocketTransport };
export type { RelayConnectionOffer, RelaySessionClientOptions };
