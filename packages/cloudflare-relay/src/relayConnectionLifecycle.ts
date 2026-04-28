import { CLIENT_PENDING_TIMEOUT_MS, CLOSE_POLICY } from "./limits.js";
import { controlFrame } from "./frames.js";
import { safeClose, safeSend } from "./socketSafety.js";
import type { RelayConnection } from "./relayState.js";
import type { WorkerWebSocket } from "./workerTypes.js";

function connectionFor(
  connections: Map<string, RelayConnection>,
  connectionId: string,
): RelayConnection {
  const existing = connections.get(connectionId);
  if (existing !== undefined) {
    return existing;
  }
  const created: RelayConnection = {
    bufferedBytes: 0,
    clientBuffer: [],
    clientSocket: null,
    dataSocketHasSentToClient: false,
    dataSocket: null,
    pendingTimer: null,
  };
  connections.set(connectionId, created);
  return created;
}

function notifyControl(
  controlSocket: WorkerWebSocket | null,
  type: "client_waiting" | "data_closed" | "client_closed",
  connectionId: string,
): void {
  if (controlSocket !== null) {
    safeSend(controlSocket, controlFrame(type, connectionId));
  }
}

function armPendingTimer(
  connections: Map<string, RelayConnection>,
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
    connections.delete(connectionId);
  }, CLIENT_PENDING_TIMEOUT_MS);
}

function clearPendingTimer(connection: RelayConnection): void {
  if (connection.pendingTimer !== null) {
    clearTimeout(connection.pendingTimer);
    connection.pendingTimer = null;
  }
}

function deleteIfIdle(
  connections: Map<string, RelayConnection>,
  connectionId: string,
  connection: RelayConnection,
): void {
  if (connection.clientSocket === null && connection.dataSocket === null) {
    clearPendingTimer(connection);
    connections.delete(connectionId);
  }
}

export {
  armPendingTimer,
  clearPendingTimer,
  connectionFor,
  deleteIfIdle,
  notifyControl,
};
