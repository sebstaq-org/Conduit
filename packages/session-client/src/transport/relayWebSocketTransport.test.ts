import { generateRelayDaemonKeyPair } from "@conduit/relay-transport";
import { afterEach, expect, it, vi } from "vitest";
import { FakeRelayWebSocket } from "./fakeRelayWebSocket.testSupport.js";
import { RelayWebSocketTransport } from "./relayWebSocketTransport.js";
import {
  relayCommandTimeoutMs,
  relayConnectTimeoutMs,
} from "./relayWebSocketOpen.js";
import type {
  RelayWebSocket,
  RelayWebSocketConstructor,
} from "./relaySessionClientOptions.js";

const closeCodeMessageTooBig = 1009;
const failOnEvent = (): void => {
  throw new Error("unexpected relay event");
};

class NeverOpenRelayWebSocket extends EventTarget implements RelayWebSocket {
  public readyState: WebSocket["readyState"] = WebSocket.CONNECTING;
  public readonly sent: string[] = [];

  public constructor(_url: string | URL, _protocols?: string | string[]) {
    super();
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data !== "string") {
      throw new TypeError("fake relay websocket expected string payload");
    }
    this.sent.push(data);
  }

  public close(): void {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

const neverOpenRelayWebSocket =
  NeverOpenRelayWebSocket as RelayWebSocketConstructor;

function relayTransport(
  WebSocketImpl: RelayWebSocketConstructor,
): RelayWebSocketTransport {
  const daemonKeys = generateRelayDaemonKeyPair();
  return new RelayWebSocketTransport(
    {
      offer: {
        daemonPublicKeyB64: daemonKeys.publicKeyB64,
        nonce: "relay-timeout-test",
        relay: {
          clientCapability: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          endpoint: "https://relay.example.test",
          serverId: "srv_relay_timeout",
        },
      },
      WebSocketImpl,
    },
    failOnEvent,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

it("rejects pending relay commands with a clear frame limit error", async () => {
  const sockets: FakeRelayWebSocket[] = [];
  const transport = relayTransport(FakeRelayWebSocket.collect(sockets));

  const response = transport.dispatch({
    command: "settings/get",
    id: "settings-over-relay",
    params: {},
    provider: "all",
  });
  await expect.poll(() => sockets[0]?.sent.length ?? 0).toBeGreaterThan(1);
  sockets[0]?.close(closeCodeMessageTooBig, "relay frame too large");

  await expect(response).rejects.toThrow(
    "Relay message too large. The session response exceeded the relay frame limit.",
  );
});

it("times out a relay socket that never opens", async () => {
  vi.useFakeTimers();
  const transport = relayTransport(neverOpenRelayWebSocket);

  const response = transport.dispatch({
    command: "settings/get",
    id: "settings-connect-timeout",
    params: {},
    provider: "all",
  });
  const assertion = expect(response).rejects.toThrow(
    "relay websocket connect timed out",
  );
  await vi.advanceTimersByTimeAsync(relayConnectTimeoutMs);

  await assertion;
});

it("times out relay commands that never receive a response", async () => {
  vi.useFakeTimers();
  const sockets: FakeRelayWebSocket[] = [];
  const transport = relayTransport(FakeRelayWebSocket.collect(sockets));

  const response = transport.dispatch({
    command: "settings/get",
    id: "settings-command-timeout",
    params: {},
    provider: "all",
  });
  await vi.waitFor(() => {
    expect(sockets[0]?.sent.length ?? 0).toBeGreaterThan(1);
  });
  const assertion = expect(response).rejects.toThrow(
    "relay command timed out",
  );
  await vi.advanceTimersByTimeAsync(relayCommandTimeoutMs);

  await assertion;
});
