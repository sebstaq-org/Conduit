import type { RelayMessage } from "./socketSafety.js";
import type { WorkerWebSocket } from "./workerTypes.js";

interface QueuedMessage {
  readonly bytes: number;
  readonly message: RelayMessage;
}

interface RelayConnection {
  bufferedBytes: number;
  readonly clientBuffer: QueuedMessage[];
  clientSocket: WorkerWebSocket | null;
  dataSocketHasSentToClient: boolean;
  dataSocket: WorkerWebSocket | null;
  pendingTimer: ReturnType<typeof setTimeout> | null;
}

interface RelayTestSnapshot {
  clientMessageCount: number;
  clientSocketCount: number;
  controlSocketCount: number;
  dataMessageCount: number;
  dataSocketCount: number;
  totalClientBytes: number;
  totalDataBytes: number;
}

function emptySnapshot(): RelayTestSnapshot {
  return {
    clientMessageCount: 0,
    clientSocketCount: 0,
    controlSocketCount: 0,
    dataMessageCount: 0,
    dataSocketCount: 0,
    totalClientBytes: 0,
    totalDataBytes: 0,
  };
}

export { emptySnapshot };
export type { QueuedMessage, RelayConnection, RelayTestSnapshot };
