import {
  CLOSE_BUFFER_LIMIT,
  CLOSE_POLICY,
  CLOSE_REPLACED,
  MAX_BUFFERED_BYTES,
  MAX_FRAME_BYTES,
} from "./limits.js";
import { frameBytes } from "./frames.js";
import { emptySnapshot } from "./relayState.js";
import { safeClose, safeSend } from "./socketSafety.js";
import {
  relayProtocolForResponse,
  websocketResponse,
} from "./websocketResponse.js";
import {
  armPendingTimer,
  clearPendingTimer,
  connectionFor,
  deleteIfIdle,
  notifyControl,
} from "./relayConnectionLifecycle.js";
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
        notifyControl(this.controlSocket, "client_waiting", connectionId);
      }
    }
  }

  private acceptClientSocket(connectionId: string, protocol: string): Response {
    const sockets = new WebSocketPair();
    const client = sockets[0];
    const server = sockets[1];
    server.accept();
    const connection = connectionFor(this.connections, connectionId);
    this.replaceClientSocket(connection);
    connection.clientSocket = server;
    this.testSnapshot.clientSocketCount += 1;
    notifyControl(this.controlSocket, "client_waiting", connectionId);
    armPendingTimer(this.connections, connectionId, connection);
    server.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
      this.handleClientMessage(connectionId, server, event.data);
    });
    server.addEventListener("close", () => {
      this.handleClientClose(connectionId, server);
    });
    server.addEventListener("error", () => {
      this.handleClientClose(connectionId, server);
    });
    return websocketResponse(client, protocol);
  }

  private replaceClientSocket(connection: RelayConnection): void {
    safeClose(
      connection.clientSocket,
      CLOSE_REPLACED,
      "client socket replaced",
    );
    safeClose(
      connection.dataSocket,
      CLOSE_REPLACED,
      "relay data socket replaced by client reconnect",
    );
    connection.dataSocket = null;
    connection.clientBuffer.length = 0;
    connection.bufferedBytes = 0;
    clearPendingTimer(connection);
  }

  private acceptDataSocket(connectionId: string, protocol: string): Response {
    const sockets = new WebSocketPair();
    const client = sockets[0];
    const server = sockets[1];
    server.accept();
    const connection = connectionFor(this.connections, connectionId);
    safeClose(connection.dataSocket, CLOSE_REPLACED, "data socket replaced");
    connection.dataSocket = server;
    this.testSnapshot.dataSocketCount += 1;
    clearPendingTimer(connection);
    this.flushClientBuffer(connection);
    server.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
      this.handleDataMessage(connectionId, server, event.data);
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
    socket: WorkerWebSocket,
    message: RelayMessage,
  ): void {
    const connection = connectionFor(this.connections, connectionId);
    if (connection.clientSocket !== socket) {
      return;
    }
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

  private handleDataMessage(
    connectionId: string,
    socket: WorkerWebSocket,
    message: RelayMessage,
  ): void {
    const connection = connectionFor(this.connections, connectionId);
    if (connection.dataSocket !== socket) {
      return;
    }
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
    notifyControl(this.controlSocket, "client_waiting", connectionId);
    armPendingTimer(this.connections, connectionId, connection);
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
    clearPendingTimer(connection);
    notifyControl(this.controlSocket, "client_closed", connectionId);
    safeClose(
      connection.dataSocket,
      CLOSE_POLICY,
      "relay client socket closed",
    );
    deleteIfIdle(this.connections, connectionId, connection);
  }

  private handleDataClose(connectionId: string, socket: WebSocket): void {
    const connection = this.connections.get(connectionId);
    if (connection?.dataSocket !== socket) {
      return;
    }
    connection.dataSocket = null;
    notifyControl(this.controlSocket, "data_closed", connectionId);
    if (connection.clientSocket !== null) {
      safeClose(
        connection.clientSocket,
        CLOSE_POLICY,
        "relay data socket closed",
      );
      connection.clientSocket = null;
      connection.clientBuffer.length = 0;
      connection.bufferedBytes = 0;
    }
    deleteIfIdle(this.connections, connectionId, connection);
  }
}

export { RelayDurableObject };
