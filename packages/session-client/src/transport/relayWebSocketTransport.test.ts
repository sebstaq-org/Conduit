import { generateRelayDaemonKeyPair } from "@conduit/relay-transport";
import { expect, it } from "vitest";
import { FakeRelayWebSocket } from "./fakeRelayWebSocket.testSupport.js";
import { RelayWebSocketTransport } from "./relayWebSocketTransport.js";

const closeCodeMessageTooBig = 1009;
const failOnEvent = (): void => {
  throw new Error("unexpected relay event");
};

it("rejects pending relay commands with a clear frame limit error", async () => {
  const sockets: FakeRelayWebSocket[] = [];
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
      WebSocketImpl: FakeRelayWebSocket.collect(sockets),
    },
    failOnEvent,
  );

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
