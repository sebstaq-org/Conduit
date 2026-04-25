import {
  CLIENT_PENDING_TIMEOUT_MS,
  CLOSE_BUFFER_LIMIT,
  CLOSE_POLICY,
  CLOSE_REPLACED,
  MAX_BUFFERED_BYTES,
  MAX_FRAME_BYTES,
} from "./limits.js";
import { controlFrame, frameBytes } from "./frames.js";
import { emptySnapshot } from "./relayState.js";
import { safeClose, safeSend } from "./socketSafety.js";
import {
  relayProtocolForResponse,
  websocketResponse,
} from "./websocketResponse.js";
import type { RelayConnection } from "./relayState.js";
import type { RelayMessage } from "./socketSafety.js";
import type { WorkerWebSocket } from "./workerTypes.js";
class RelayDurableObject {
  private readonly connections = new Map<string, RelayConnection>();
  private controlSocket: WorkerWebSocket | null = null;
  private readonly testSnapshot = emptySnapshot();
  public fetch(request: Request): Response {
    const url = new URL(request.url);
    const socketKind = url.searchParams.get("socketKind");
    const connectionId = url.searchParams.get("connectionId") ?? undefined;
    if (socketKind === "testCloseData" && connectionId !== undefined) {
      return this.testCloseDataSocket(connectionId);
    }
    if (socketKind === "testSnapshot") {
      return Response.json(this.testSnapshot);
    }
    const protocol = relayProtocolForResponse(request);
    if (socketKind === "control") {
      return this.acceptControlSocket(protocol);
    }
    if (socketKind === "client" && connectionId !== undefined) {
      return this.acceptClientSocket(connectionId, protocol);
    }
    if (socketKind === "data" && connectionId !== undefined) {
      return this.acceptDataSocket(connectionId, protocol);
    }
    return new Response("invalid relay socket", { status: 400 });
  }
  private testCloseDataSocket(connectionId: string): Response {
    const connection = this.connections.get(connectionId);
    safeClose(
      connection?.dataSocket ?? null,
      CLOSE_POLICY,
      "relay test closed data socket",
    );
    return Response.json({ ok: true });
  }
  private acceptControlSocket(protocol: string): Response {
    const sockets = new WebSocketPair();
    const client = sockets[0];
    const server = sockets[1];
    server.accept();
    safeClose(this.controlSocket, CLOSE_REPLACED, "control socket replaced");
    this.controlSocket = server;
    this.testSnapshot.controlSocketCount += 1;
    this.notifyPendingClients();
    server.addEventListener("close", () => {
      if (this.controlSocket === server) {
        this.controlSocket = null;
      }
    });
    server.addEventListener("error", () => {
      if (this.controlSocket === server) {
        this.controlSocket = null;
      }
    });
    return websocketResponse(client, protocol);
  }

  private notifyPendingClients(): void {
    for (const [connectionId, { clientSocket, dataSocket }] of this
      .connections) {
      if (clientSocket !== null && dataSocket === null) {
        this.notifyControl("client_waiting", connectionId);
      }
    }
  }

  private acceptClientSocket(connectionId: string, protocol: string): Response {
    const existing = this.connections.get(connectionId);
    if (
      existing?.clientSocket !== null &&
      existing?.clientSocket !== undefined
    ) {
      return new Response("relay client socket already connected", {
        status: 409,
      });
    }
    const sockets = new WebSocketPair();
    const client = sockets[0];
    const server = sockets[1];
    server.accept();
    const connection = this.connectionFor(connectionId);
    connection.clientSocket = server;
    this.testSnapshot.clientSocketCount += 1;
    this.notifyControl("client_waiting", connectionId);
    this.armPendingTimer(connectionId, connection);
    server.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
      this.handleClientMessage(connectionId, event.data);
    });
    server.addEventListener("close", () => {
      this.handleClientClose(connectionId, server);
    });
    server.addEventListener("error", () => {
      this.handleClientClose(connectionId, server);
    });
    return websocketResponse(client, protocol);
  }

  private acceptDataSocket(connectionId: string, protocol: string): Response {
    const sockets = new WebSocketPair();
    const client = sockets[0];
    const server = sockets[1];
    server.accept();
    const connection = this.connectionFor(connectionId);
    safeClose(connection.dataSocket, CLOSE_REPLACED, "data socket replaced");
    connection.dataSocket = server;
    this.testSnapshot.dataSocketCount += 1;
    this.clearPendingTimer(connection);
    this.flushClientBuffer(connection);
    server.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
      this.handleDataMessage(connectionId, event.data);
    });
    server.addEventListener("close", () => {
      this.handleDataClose(connectionId, server);
    });
    server.addEventListener("error", () => {
      this.handleDataClose(connectionId, server);
    });
    return websocketResponse(client, protocol);
  }

  private handleClientMessage(
    connectionId: string,
    message: RelayMessage,
  ): void {
    const connection = this.connectionFor(connectionId);
    const bytes = frameBytes(message);
    this.testSnapshot.clientMessageCount += 1;
    this.testSnapshot.totalClientBytes += bytes;
    if (bytes > MAX_FRAME_BYTES) {
      safeClose(
        connection.clientSocket,
        CLOSE_BUFFER_LIMIT,
        "relay frame too large",
      );
      return;
    }
    if (connection.dataSocket !== null) {
      safeSend(connection.dataSocket, message);
      return;
    }
    this.queueClientMessage(connectionId, connection, message, bytes);
  }

  private handleDataMessage(connectionId: string, message: RelayMessage): void {
    const connection = this.connectionFor(connectionId);
    const bytes = frameBytes(message);
    this.testSnapshot.dataMessageCount += 1;
    this.testSnapshot.totalDataBytes += bytes;
    if (bytes > MAX_FRAME_BYTES) {
      safeClose(
        connection.dataSocket,
        CLOSE_BUFFER_LIMIT,
        "relay frame too large",
      );
      return;
    }
    if (connection.clientSocket === null) {
      safeClose(connection.dataSocket, CLOSE_POLICY, "relay client missing");
      return;
    }
    safeSend(connection.clientSocket, message);
  }

  private queueClientMessage(
    connectionId: string,
    connection: RelayConnection,
    message: RelayMessage,
    bytes: number,
  ): void {
    if (connection.bufferedBytes + bytes > MAX_BUFFERED_BYTES) {
      safeClose(
        connection.clientSocket,
        CLOSE_BUFFER_LIMIT,
        "relay buffered data limit exceeded",
      );
      return;
    }
    connection.clientBuffer.push({ bytes, message });
    connection.bufferedBytes += bytes;
    this.notifyControl("client_waiting", connectionId);
    this.armPendingTimer(connectionId, connection);
  }

  private flushClientBuffer(connection: RelayConnection): void {
    if (connection.dataSocket === null) {
      return;
    }
    for (const queued of connection.clientBuffer) {
      safeSend(connection.dataSocket, queued.message);
    }
    connection.clientBuffer.length = 0;
    connection.bufferedBytes = 0;
  }

  private handleClientClose(connectionId: string, socket: WebSocket): void {
    const connection = this.connections.get(connectionId);
    if (connection?.clientSocket !== socket) {
      return;
    }
    connection.clientSocket = null;
    connection.clientBuffer.length = 0;
    connection.bufferedBytes = 0;
    this.clearPendingTimer(connection);
    this.notifyControl("client_closed", connectionId);
    safeClose(connection.dataSocket, CLOSE_POLICY, "relay client socket closed");
    this.deleteIfIdle(connectionId, connection);
  }

  private handleDataClose(connectionId: string, socket: WebSocket): void {
    const connection = this.connections.get(connectionId);
    if (connection?.dataSocket !== socket) {
      return;
    }
    connection.dataSocket = null;
    this.notifyControl("data_closed", connectionId);
    if (connection.clientSocket !== null) {
      this.armPendingTimer(connectionId, connection);
    }
    this.deleteIfIdle(connectionId, connection);
  }

  private connectionFor(connectionId: string): RelayConnection {
    const existing = this.connections.get(connectionId);
    if (existing !== undefined) {
      return existing;
    }
    const created: RelayConnection = {
      bufferedBytes: 0,
      clientBuffer: [],
      clientSocket: null,
      dataSocket: null,
      pendingTimer: null,
    };
    this.connections.set(connectionId, created);
    return created;
  }

  private notifyControl(
    type: "client_waiting" | "data_closed" | "client_closed",
    connectionId: string,
  ): void {
    if (this.controlSocket !== null) {
      safeSend(this.controlSocket, controlFrame(type, connectionId));
    }
  }

  private armPendingTimer(
    connectionId: string,
    connection: RelayConnection,
  ): void {
    if (connection.dataSocket !== null || connection.pendingTimer !== null) {
      return;
    }
    connection.pendingTimer = setTimeout(() => {
      safeClose(
        connection.clientSocket,
        CLOSE_POLICY,
        "relay data socket timeout",
      );
      this.connections.delete(connectionId);
    }, CLIENT_PENDING_TIMEOUT_MS);
  }

  private clearPendingTimer(connection: RelayConnection): void {
    if (connection.pendingTimer !== null) {
      clearTimeout(connection.pendingTimer);
      connection.pendingTimer = null;
    }
  }

  private deleteIfIdle(
    connectionId: string,
    connection: RelayConnection,
  ): void {
    if (connection.clientSocket === null && connection.dataSocket === null) {
      this.clearPendingTimer(connection);
      this.connections.delete(connectionId);
    }
  }
}

export { RelayDurableObject };
