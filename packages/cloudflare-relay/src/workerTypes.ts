type DurableObjectIdLike = object;

interface DurableObjectNamespaceLike {
  get(id: DurableObjectIdLike): DurableObjectStubLike;
  idFromName(name: string): DurableObjectIdLike;
}

interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

interface WorkerWebSocket extends WebSocket {
  accept(): void;
  send(message: ArrayBuffer | string): void;
}

interface WebSocketPairLike {
  readonly 0: WorkerWebSocket;
  readonly 1: WorkerWebSocket;
}

interface WebSocketResponseInit extends ResponseInit {
  readonly webSocket: WorkerWebSocket;
}

declare global {
  const WebSocketPair: new () => WebSocketPairLike;

  interface Response {
    readonly webSocket?: WorkerWebSocket | null;
  }
}

export type {
  DurableObjectNamespaceLike,
  WebSocketResponseInit,
  WorkerWebSocket,
};
