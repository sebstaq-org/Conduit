import { CONDUIT_TRANSPORT_VERSION } from "@conduit/session-contracts";
import { createRelayClientHandshake } from "@conduit/relay-transport";
import { readRelayCipherFrame } from "./relayCipherFrame.js";
import { relayCloseError } from "./relayCloseError.js";
import { relaySocketRoute } from "./relayRoute.js";
import {
  createPendingRelayResponse,
  rejectRelayCommandTimeout,
  waitForRelaySocketOpen,
} from "./relayWebSocketOpen.js";
import { parseServerFrame } from "./wireFrame.js";
import type { RelayCipherChannel, RelayCipherFrame } from "@conduit/relay-transport";
import type { ConduitRuntimeEvent } from "@conduit/app-protocol";
import type { CommandTransport } from "./commandTransport.js";
import type { RelaySessionClientOptions, RelayWebSocket } from "./relaySessionClientOptions.js";
import type { ParsedServerFrame } from "./wireFrame.js";
import type { ConsumerCommand, ConsumerResponse } from "@conduit/session-contracts";
import type { PendingRelayResponse } from "./relayWebSocketOpen.js";
const transportVersionField = "v";

class RelayWebSocketTransport implements CommandTransport {
  private readonly handleEvent: (event: ConduitRuntimeEvent) => void;
  private readonly options: RelaySessionClientOptions;
  private readonly pending = new Map<
    string,
    PendingRelayResponse
  >();
  private channel: RelayCipherChannel | null = null;
  private connecting: Promise<RelayWebSocket> | null = null;
  private socket: RelayWebSocket | null = null;
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
      const response = await responseDeferred.deferred.promise;
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

  public close(): void {
    const socket = this.socket;
    this.handleClose();
    socket?.close();
  }
  private async sendCommand(
    command: ConsumerCommand,
  ): Promise<PendingRelayResponse> {
    const socket = await this.openSocket();
    const responseDeferred = this.trackResponse(command.id);
    const encrypted = await this.encryptCommand(command);
    try {
      socket.send(JSON.stringify(encrypted));
      return responseDeferred;
    } catch (error) {
      this.handleSendFailure(command, responseDeferred, error);
      throw error;
    }
  }
  private handleSendFailure(
    command: ConsumerCommand,
    responseDeferred: PendingRelayResponse,
    error: unknown,
  ): void {
    this.pending.delete(command.id);
    clearTimeout(responseDeferred.timeout);
    responseDeferred.deferred.reject(new Error("relay websocket send failed"));
    this.emitTelemetry({
      event_name: "session_client.relay.send_failed",
      fields: { command, error, ok: false },
      level: "warn",
    });
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
  private async openSocket(): Promise<RelayWebSocket> {
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
  private async connectSocket(): Promise<RelayWebSocket> {
    const route = relaySocketRoute(this.options.offer);
    this.logConnectStart();
    const socket = this.createSocket(route.url, route.protocol);
    try {
      await this.openConnectedSocket(socket, route.connectionId);
      this.connecting = null;
      return socket;
    } catch (error) {
      this.handleConnectFailure(socket);
      throw error;
    }
  }
  private createSocket(url: string, protocol: string): RelayWebSocket {
    const Socket = this.options.WebSocketImpl ?? WebSocket;
    const socket = new Socket(url, [protocol]);
    this.socket = socket;
    this.bindSocketEvents(socket);
    return socket;
  }
  private async openConnectedSocket(
    socket: RelayWebSocket,
    connectionId: string,
  ): Promise<void> {
    await waitForRelaySocketOpen(socket, {
      emitTelemetry: (event) => {
        this.emitTelemetry(event);
      },
      onConnectFailed: () => {
        this.connecting = null;
      },
    });
    await this.sendHandshake(socket, connectionId);
  }
  private handleConnectFailure(socket: RelayWebSocket): void {
    this.connecting = null;
    this.channel = null;
    socket.close();
  }
  private bindSocketEvents(socket: RelayWebSocket): void {
    socket.addEventListener("message", (event: MessageEvent) => {
      void this.handleMessage(event);
    });
    socket.addEventListener("close", (event: CloseEvent) => {
      this.handleClose(event);
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
    socket: RelayWebSocket,
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
  private trackResponse(id: string): PendingRelayResponse {
    const pending = createPendingRelayResponse(() => {
      this.handleCommandTimeout(id);
    });
    this.pending.set(id, pending);
    return pending;
  }
  private handleCommandTimeout(id: string): void {
    rejectRelayCommandTimeout({
      closeSocket: () => {
        this.socket?.close();
      },
      emitTelemetry: (event) => {
        this.emitTelemetry(event);
      },
      id,
      pending: this.pending,
    });
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
      const pending = this.pending.get(frame.id);
      if (pending !== undefined) {
        clearTimeout(pending.timeout);
        pending.deferred.resolve(frame.response);
      }
      this.pending.delete(frame.id);
      return;
    }
    this.handleEvent(frame.event);
  }
  private handleClose(event?: CloseEvent): void {
    const pendingCount = this.pending.size;
    const error = relayCloseError(event, "relay websocket closed");
    this.channel = null;
    this.socket = null;
    this.connecting = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.deferred.reject(error);
    }
    this.pending.clear();
    this.emitTelemetry({
      event_name: "session_client.relay.socket.closed",
      fields: {
        close_code: event?.code ?? null,
        close_reason: event?.reason ?? null,
        error,
        pending_count: pendingCount,
      },
      level: "warn",
    });
  }
  private requireChannel(): RelayCipherChannel {
    if (this.channel === null) {
      throw new Error("relay cipher channel is not established");
    }
    return this.channel;
  }
  private emitTelemetry(
    event: Parameters<
      NonNullable<RelaySessionClientOptions["onTelemetryEvent"]>
    >[0],
  ): void {
    this.options.onTelemetryEvent?.(event);
  }
}
export { RelayWebSocketTransport };
