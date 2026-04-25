import { CLOSE_POLICY } from "./limits.js";
import type { WorkerWebSocket } from "./workerTypes.js";

type RelayMessage = ArrayBuffer | string;

function safeClose(
  socket: WorkerWebSocket | null,
  code: number,
  reason: string,
): void {
  try {
    socket?.close(code, reason);
  } catch {
    // Socket is already closed; relay cleanup runs through close handlers.
  }
}

function safeSend(socket: WorkerWebSocket, message: RelayMessage): void {
  try {
    socket.send(message);
  } catch {
    safeClose(socket, CLOSE_POLICY, "relay socket send failed");
  }
}

export { safeClose, safeSend };
export type { RelayMessage };
