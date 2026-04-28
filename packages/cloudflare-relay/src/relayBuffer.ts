import { CLOSE_BUFFER_LIMIT, MAX_BUFFERED_BYTES } from "./limits.js";
import { safeClose, safeSend } from "./socketSafety.js";
import { armPendingTimer, notifyControl } from "./relayConnectionLifecycle.js";
import type { RelayConnection } from "./relayState.js";
import type { RelayMessage } from "./socketSafety.js";
import type { WorkerWebSocket } from "./workerTypes.js";

interface RelayBufferContext {
  readonly connections: Map<string, RelayConnection>;
  readonly controlSocket: WorkerWebSocket | null;
  readonly connection: RelayConnection;
  readonly connectionId: string;
}

interface RelayQueueRequest {
  readonly bytes: number;
  readonly message: RelayMessage;
  readonly notifyWaiting: boolean;
}

function queueClientMessageWithNotify(
  context: RelayBufferContext,
  request: RelayQueueRequest,
): void {
  const { connection, connectionId, connections, controlSocket } = context;
  if (connection.bufferedBytes + request.bytes > MAX_BUFFERED_BYTES) {
    safeClose(
      connection.clientSocket,
      CLOSE_BUFFER_LIMIT,
      "relay buffered data limit exceeded",
    );
    return;
  }
  connection.clientBuffer.push({
    bytes: request.bytes,
    message: request.message,
  });
  connection.bufferedBytes += request.bytes;
  if (request.notifyWaiting) {
    notifyControl(controlSocket, "client_waiting", connectionId);
  }
  armPendingTimer(connections, connectionId, connection);
}

function queueClientMessage(
  context: RelayBufferContext,
  message: RelayMessage,
  bytes: number,
): void {
  queueClientMessageWithNotify(context, {
    bytes,
    message,
    notifyWaiting: true,
  });
}

function queueClientMessageSilently(
  context: RelayBufferContext,
  message: RelayMessage,
  bytes: number,
): void {
  queueClientMessageWithNotify(context, {
    bytes,
    message,
    notifyWaiting: false,
  });
}

function markDataSocketClosed(context: RelayBufferContext): void {
  const { connection, connectionId, connections, controlSocket } = context;
  connection.dataSocket = null;
  connection.state = { kind: "waitingForData" };
  notifyControl(controlSocket, "data_closed", connectionId);
  armPendingTimer(connections, connectionId, connection);
}

function flushNextClientMessage(context: RelayBufferContext): boolean {
  const queued = context.connection.clientBuffer[0];
  const dataSocket = context.connection.dataSocket;
  if (queued === undefined || dataSocket === null) {
    return false;
  }
  if (!safeSend(dataSocket, queued.message)) {
    markDataSocketClosed(context);
    return false;
  }
  context.connection.clientBuffer.shift();
  context.connection.bufferedBytes -= queued.bytes;
  return true;
}

function flushClientBuffer(context: RelayBufferContext): void {
  if (context.connection.dataSocket === null) {
    return;
  }
  while (context.connection.clientBuffer.length > 0) {
    if (!flushNextClientMessage(context)) {
      return;
    }
  }
  context.connection.bufferedBytes = 0;
}

export { flushClientBuffer, queueClientMessage, queueClientMessageSilently };
export type { RelayBufferContext };
