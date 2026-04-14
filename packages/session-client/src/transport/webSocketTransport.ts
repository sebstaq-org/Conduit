import { CONDUIT_TRANSPORT_VERSION } from "@conduit/session-contracts";
import { createDeferred } from "./deferred.js";
import { parseServerFrame } from "./wireFrame.js";
import { requireWebSocketUrl } from "./webSocketUrl.js";
import type {
  ConsumerCommand,
  ConsumerResponse,
  RuntimeEvent,
  ServerFrame,
} from "@conduit/session-contracts";

const transportVersionField = "v";

interface WebSocketTransportOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
}

class WebSocketTransport {
  private readonly handleEvent: (event: RuntimeEvent) => void;
  private readonly options: WebSocketTransportOptions;
  private readonly pending = new Map<
    string,
    PromiseWithResolvers<ConsumerResponse>
  >();
  private connecting: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;

  public constructor(
    options: WebSocketTransportOptions,
    handleEvent: (event: RuntimeEvent) => void,
  ) {
    this.options = options;
    this.handleEvent = handleEvent;
  }

  public async dispatch(command: ConsumerCommand): Promise<ConsumerResponse> {
    const socket = await this.openSocket();
    const response = this.trackResponse(command.id);
    socket.send(
      JSON.stringify({
        [transportVersionField]: CONDUIT_TRANSPORT_VERSION,
        type: "command",
        id: command.id,
        command,
      }),
    );
    return response;
  }

  private async openSocket(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket;
    }
    if (this.connecting) {
      const socket = await this.connecting;
      return socket;
    }
    this.connecting = this.connectSocket();
    const socket = await this.connecting;
    return socket;
  }

  private async connectSocket(): Promise<WebSocket> {
    const Socket = this.options.WebSocketImpl ?? WebSocket;
    const socket = new Socket(requireWebSocketUrl(this.options.url));
    this.socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      this.handleMessage(event);
    });
    socket.addEventListener("close", () => {
      this.handleClose();
    });
    const openedSocket = await this.waitForOpen(socket);
    return openedSocket;
  }

  private async waitForOpen(socket: WebSocket): Promise<WebSocket> {
    const deferred = createDeferred<WebSocket>();
    socket.addEventListener("open", () => {
      this.connecting = null;
      deferred.resolve(socket);
    });
    socket.addEventListener("error", () => {
      this.connecting = null;
      deferred.reject(new Error("session websocket failed to connect"));
    });
    const openedSocket = await deferred.promise;
    return openedSocket;
  }

  private async trackResponse(id: string): Promise<ConsumerResponse> {
    const deferred = createDeferred<ConsumerResponse>();
    this.pending.set(id, deferred);
    const response = await deferred.promise;
    return response;
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }
    const frame = parseServerFrame(event.data);
    if (!frame) {
      return;
    }
    this.handleServerFrame(frame);
  }

  private handleServerFrame(frame: ServerFrame): void {
    if (frame.type === "response") {
      this.pending.get(frame.id)?.resolve(frame.response);
      this.pending.delete(frame.id);
      return;
    }
    this.handleEvent(frame.event);
  }

  private handleClose(): void {
    this.socket = null;
    this.connecting = null;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("session websocket closed"));
    }
    this.pending.clear();
  }
}

export { WebSocketTransport };
