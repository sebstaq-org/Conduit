import { CLOSE_BUFFER_LIMIT, MAX_FRAME_BYTES } from "./limits.js";
import { frameBytes } from "./frames.js";
import {
  queueClientMessage,
  queueClientMessageSilently,
} from "./relayBuffer.js";
import {
  notifyControl,
  recycleDataSocket,
} from "./relayConnectionLifecycle.js";
import { safeClose, safeSend } from "./socketSafety.js";
import type { RelayBufferContext } from "./relayBuffer.js";
import type { RelayConnection, RelayTestSnapshot } from "./relayState.js";
import type { RelayMessage } from "./socketSafety.js";
import type { WorkerWebSocket } from "./workerTypes.js";

interface RelayClientMessageContext extends RelayBufferContext {
  readonly message: RelayMessage;
  readonly socket: WorkerWebSocket;
  readonly snapshot: RelayTestSnapshot;
}

interface RelayClientDeliveryContext extends RelayBufferContext {
  readonly bytes: number;
  readonly message: RelayMessage;
}

function recordClientMessage(snapshot: RelayTestSnapshot, bytes: number): void {
  snapshot.clientMessageCount += 1;
  snapshot.totalClientBytes += bytes;
}

function closeOversizedClientFrame(connection: RelayConnection): void {
  safeClose(
    connection.clientSocket,
    CLOSE_BUFFER_LIMIT,
    "relay frame too large",
  );
}

function shouldRecycleDataSocket(connection: RelayConnection): boolean {
  return (
    connection.state.kind === "connected" && connection.state.serverResponded
  );
}

function recycleAndQueueClientMessage(
  context: RelayClientDeliveryContext,
): void {
  recycleDataSocket(context.connection);
  queueClientMessageSilently(context, context.message, context.bytes);
  notifyControl(context.controlSocket, "data_closed", context.connectionId);
  notifyControl(context.controlSocket, "client_waiting", context.connectionId);
}

function sendOrQueueClientMessage(context: RelayClientDeliveryContext): void {
  const dataSocket = context.connection.dataSocket;
  if (dataSocket !== null && safeSend(dataSocket, context.message)) {
    return;
  }
  context.connection.dataSocket = null;
  context.connection.state = { kind: "waitingForData" };
  queueClientMessageSilently(context, context.message, context.bytes);
  notifyControl(context.controlSocket, "data_closed", context.connectionId);
  notifyControl(context.controlSocket, "client_waiting", context.connectionId);
}

function deliverClientMessage(context: RelayClientDeliveryContext): void {
  if (context.connection.dataSocket === null) {
    queueClientMessage(context, context.message, context.bytes);
    return;
  }
  if (shouldRecycleDataSocket(context.connection)) {
    recycleAndQueueClientMessage(context);
    return;
  }
  sendOrQueueClientMessage(context);
}

function deliveryContext(
  context: RelayClientMessageContext,
  bytes: number,
): RelayClientDeliveryContext {
  return {
    bytes,
    connection: context.connection,
    connectionId: context.connectionId,
    connections: context.connections,
    controlSocket: context.controlSocket,
    message: context.message,
  };
}

function handleRelayClientMessage(context: RelayClientMessageContext): void {
  if (context.connection.clientSocket !== context.socket) {
    return;
  }
  const bytes = frameBytes(context.message);
  recordClientMessage(context.snapshot, bytes);
  if (bytes > MAX_FRAME_BYTES) {
    closeOversizedClientFrame(context.connection);
    return;
  }
  deliverClientMessage(deliveryContext(context, bytes));
}

export { handleRelayClientMessage };
