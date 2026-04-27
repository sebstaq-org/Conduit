import { generateRelayDaemonKeyPair } from "@conduit/relay-transport";
import { expect, it } from "vitest";
import { RelayWebSocketTransport } from "./relayWebSocketTransport.js";

const closeCodeMessageTooBig = 1009;

it("rejects pending relay commands with a clear frame limit error", async () => {
  const sockets: FakeWebSocket[] = [];
  const daemonKeys = generateRelayDaemonKeyPair();
  const transport = new RelayWebSocketTransport(
    {
      offer: {
        daemonPublicKeyB64: daemonKeys.publicKeyB64,
        nonce: "relay-frame-limit-test",
        relay: {
          clientCapability: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          endpoint: "https://relay.example.test",
          serverId: "srv_relay_frame_limit",
        },
      },
      WebSocketImpl: fakeWebSocketFactory(sockets),
    },
    () => undefined,
  );

  const response = transport.dispatch({
    command: "settings/get",
    id: "settings-over-relay",
    params: {},
    provider: "all",
  });
  await nextTask();
  sockets[0]?.close(closeCodeMessageTooBig, "relay frame too large");

  await expect(response).rejects.toThrow(
    "Relay message too large. The session response exceeded the relay frame limit.",
  );
});

function fakeWebSocketFactory(sockets: FakeWebSocket[]): typeof WebSocket {
  return class TestWebSocket extends FakeWebSocket {
    public static readonly CLOSED = WebSocket.CLOSED;
    public static readonly CLOSING = WebSocket.CLOSING;
    public static readonly CONNECTING = WebSocket.CONNECTING;
    public static readonly OPEN = WebSocket.OPEN;

    public constructor(_url: string | URL, _protocols?: string | string[]) {
      super();
      sockets.push(this);
    }
  } as unknown as typeof WebSocket;
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

class FakeWebSocket extends EventTarget {
  public readyState: number = WebSocket.CONNECTING;
  public readonly sent: string[] = [];

  public constructor() {
    super();
    queueMicrotask(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.sent.push(String(data));
  }

  public close(code = 1000, reason = ""): void {
    this.readyState = WebSocket.CLOSED;
    const event = new Event("close") as CloseEvent;
    Object.defineProperties(event, {
      code: { value: code },
      reason: { value: reason },
    });
    this.dispatchEvent(event);
  }
}
