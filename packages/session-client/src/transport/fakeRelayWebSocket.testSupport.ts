import type {
  RelayWebSocket,
  RelayWebSocketConstructor,
} from "./relaySessionClientOptions.js";

class FakeRelayWebSocket extends EventTarget implements RelayWebSocket {
  private static sockets: FakeRelayWebSocket[] = [];
  public readyState: WebSocket["readyState"] = WebSocket.CONNECTING;
  public readonly sent: string[] = [];

  public constructor(_url: string | URL, _protocols?: string | string[]) {
    super();
    FakeRelayWebSocket.sockets.push(this);
    queueMicrotask(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  public static collect(
    sockets: FakeRelayWebSocket[],
  ): RelayWebSocketConstructor {
    FakeRelayWebSocket.sockets = sockets;
    return FakeRelayWebSocket;
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data !== "string") {
      throw new TypeError("fake relay websocket expected string payload");
    }
    this.sent.push(data);
  }

  public close(code = 1000, reason = ""): void {
    this.readyState = WebSocket.CLOSED;
    const event = new Event("close");
    Object.defineProperties(event, {
      code: { value: code },
      reason: { value: reason },
    });
    this.dispatchEvent(event);
  }
}

export { FakeRelayWebSocket };
