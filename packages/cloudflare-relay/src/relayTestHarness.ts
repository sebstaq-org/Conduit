import {
  acceptRelayClientHandshake,
  buildRelayWebSocketProtocol,
  buildRelayWebSocketUrl,
  createRelayClientHandshake,
  deriveRelayConnectionId,
  deriveRelayServerId,
  generateRelayDaemonKeyPair,
  generateRelayCapability,
  parseRelayEnvelope,
} from "@conduit/relay-transport";
import { expect } from "vitest";

type TestSocket = Pick<WebSocket, "addEventListener" | "close" | "send">;

interface RelayTestHarness {
  readonly endpoint: string;
  readonly fetchJson: (path: string) => Promise<unknown>;
  readonly openRejectedSocket: (
    url: string,
    capability?: string,
  ) => Promise<void>;
  readonly openSocket: (url: string, capability: string) => Promise<TestSocket>;
}

const plaintextFromClient = "PLAINTEXT_CLIENT_MARKER_DO_NOT_LEAK";
const plaintextFromServer = "PLAINTEXT_SERVER_MARKER_DO_NOT_LEAK";
const reconnectPlaintext = "PLAINTEXT_RECONNECT_MARKER_DO_NOT_LEAK";
const largeSessionSnapshotPlaintext = `${"SESSION_OPEN_SNAPSHOT_".repeat(4096)}END`;

async function runRelayHealthCheck(harness: RelayTestHarness): Promise<void> {
  await expect(harness.fetchJson("/health")).resolves.toEqual({
    ok: true,
    service: "conduit-relay",
  });
}

async function runRelayRoundtripScenario(
  harness: RelayTestHarness,
  suffix: string,
): Promise<void> {
  const daemonCapability = generateRelayCapability();
  const clientCapability = generateRelayCapability();
  const relayServerId = deriveRelayServerId(daemonCapability);
  const connectionId = deriveRelayConnectionId(clientCapability);
  const context = {
    connectionId,
    offerNonce: `relay-roundtrip-${suffix}`,
    serverId: relayServerId,
  };
  const daemonKeys = generateRelayDaemonKeyPair();
  const control = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  const clientWaiting = waitForMessage(control, "roundtrip control");
  const client = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: clientCapability,
      connectionId,
      role: "client",
      serverId: relayServerId,
    }),
    clientCapability,
  );

  expect(parseRelayEnvelope(await clientWaiting)).toMatchObject({
    connectionId,
    type: "client_waiting",
  });

  const clientHandshake = await createRelayClientHandshake({
    context,
    daemonPublicKeyB64: daemonKeys.publicKeyB64,
  });
  const firstCipherFrame =
    await clientHandshake.channel.encryptUtf8(plaintextFromClient);
  const rawHandshake = JSON.stringify(clientHandshake.handshake);
  const rawFirstCipherFrame = JSON.stringify(firstCipherFrame);
  expect(rawFirstCipherFrame).not.toContain(plaintextFromClient);
  client.send(rawHandshake);
  client.send(rawFirstCipherFrame);

  const data = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      connectionId,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  await expect(waitForMessage(data, "roundtrip handshake")).resolves.toBe(
    rawHandshake,
  );
  const rawAtDaemon = await waitForMessage(data, "roundtrip first cipher");
  expect(rawAtDaemon).toBe(rawFirstCipherFrame);
  expect(rawAtDaemon).not.toContain(plaintextFromClient);

  const daemonChannel = await acceptRelayClientHandshake({
    context,
    daemonSecretKeyB64: daemonKeys.secretKeyB64,
    handshake: JSON.parse(rawHandshake) as typeof clientHandshake.handshake,
  });
  await expect(
    daemonChannel.decryptUtf8(
      JSON.parse(rawAtDaemon) as typeof firstCipherFrame,
    ),
  ).resolves.toBe(plaintextFromClient);

  const serverCipherFrame =
    await daemonChannel.encryptUtf8(plaintextFromServer);
  const rawServerCipherFrame = JSON.stringify(serverCipherFrame);
  expect(rawServerCipherFrame).not.toContain(plaintextFromServer);
  data.send(rawServerCipherFrame);
  const rawAtClient = await waitForMessage(client, "roundtrip server cipher");
  expect(rawAtClient).toBe(rawServerCipherFrame);
  expect(rawAtClient).not.toContain(plaintextFromServer);
  await expect(
    clientHandshake.channel.decryptUtf8(
      JSON.parse(rawAtClient) as typeof serverCipherFrame,
    ),
  ).resolves.toBe(plaintextFromServer);

  data.close();
  await waitForEnvelope(control, "data_closed", connectionId);
  const reconnectFrame =
    await clientHandshake.channel.encryptUtf8(reconnectPlaintext);
  const rawReconnectFrame = JSON.stringify(reconnectFrame);
  expect(rawReconnectFrame).not.toContain(reconnectPlaintext);
  client.send(rawReconnectFrame);
  const dataReconnect = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      connectionId,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  const rawReconnectAtDaemon = await waitForMessage(
    dataReconnect,
    "roundtrip reconnect",
  );
  expect(rawReconnectAtDaemon).toBe(rawReconnectFrame);
  await expect(
    daemonChannel.decryptUtf8(
      JSON.parse(rawReconnectAtDaemon) as typeof reconnectFrame,
    ),
  ).resolves.toBe(reconnectPlaintext);

  dataReconnect.close();
  client.close();
  control.close();
}

async function runRelayLargeServerFrameScenario(
  harness: RelayTestHarness,
): Promise<void> {
  const daemonCapability = generateRelayCapability();
  const clientCapability = generateRelayCapability();
  const relayServerId = deriveRelayServerId(daemonCapability);
  const connectionId = deriveRelayConnectionId(clientCapability);
  const context = {
    connectionId,
    offerNonce: "relay-large-server-frame",
    serverId: relayServerId,
  };
  const daemonKeys = generateRelayDaemonKeyPair();
  const control = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  const clientWaiting = waitForMessage(control, "large frame control");
  const client = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: clientCapability,
      connectionId,
      role: "client",
      serverId: relayServerId,
    }),
    clientCapability,
  );
  expect(parseRelayEnvelope(await clientWaiting)).toMatchObject({
    connectionId,
    type: "client_waiting",
  });

  const clientHandshake = await createRelayClientHandshake({
    context,
    daemonPublicKeyB64: daemonKeys.publicKeyB64,
  });
  const rawHandshake = JSON.stringify(clientHandshake.handshake);
  client.send(rawHandshake);
  const data = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      connectionId,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  await expect(waitForMessage(data, "large frame handshake")).resolves.toBe(
    rawHandshake,
  );

  const daemonChannel = await acceptRelayClientHandshake({
    context,
    daemonSecretKeyB64: daemonKeys.secretKeyB64,
    handshake: JSON.parse(rawHandshake) as typeof clientHandshake.handshake,
  });
  const largeFrame = await daemonChannel.encryptUtf8(
    largeSessionSnapshotPlaintext,
  );
  const rawLargeFrame = JSON.stringify(largeFrame);
  expect(rawLargeFrame.length).toBeGreaterThan(65_536);
  expect(rawLargeFrame).not.toContain(largeSessionSnapshotPlaintext);
  data.send(rawLargeFrame);

  const rawAtClient = await waitForMessage(client, "large server frame");
  expect(rawAtClient).toBe(rawLargeFrame);
  await expect(
    clientHandshake.channel.decryptUtf8(
      JSON.parse(rawAtClient) as typeof largeFrame,
    ),
  ).resolves.toBe(largeSessionSnapshotPlaintext);

  data.close();
  client.close();
  control.close();
}

async function runRelayClientCloseCleansDataScenario(
  harness: RelayTestHarness,
): Promise<void> {
  const daemonCapability = generateRelayCapability();
  const clientCapability = generateRelayCapability();
  const relayServerId = deriveRelayServerId(daemonCapability);
  const connectionId = deriveRelayConnectionId(clientCapability);
  const control = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  const clientWaiting = waitForMessage(control, "client close control");
  const client = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: clientCapability,
      connectionId,
      role: "client",
      serverId: relayServerId,
    }),
    clientCapability,
  );
  expect(parseRelayEnvelope(await clientWaiting)).toMatchObject({
    connectionId,
    type: "client_waiting",
  });

  const data = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      connectionId,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );

  client.close();

  await waitForEnvelope(control, "client_closed", connectionId);
  await waitForEnvelope(control, "data_closed", connectionId);
  data.close();
  control.close();
}

async function waitForEnvelope(
  socket: TestSocket,
  type: "client_waiting" | "data_closed" | "client_closed",
  connectionId: string,
): Promise<void> {
  for (let attempts = 0; attempts < 6; attempts += 1) {
    const envelope = parseRelayEnvelope(await waitForMessage(socket, type));
    if (envelope.type === type && envelope.connectionId === connectionId) {
      return;
    }
  }
  throw new Error(`relay envelope ${type} for ${connectionId} not observed`);
}

function waitForMessage(
  socket: TestSocket,
  label = "relay message",
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`timed out waiting for ${label}`));
      }
    }, 5000);
    socket.addEventListener("message", (event: MessageEvent) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (typeof event.data !== "string") {
        reject(new Error("relay test expected string websocket frame"));
        return;
      }
      resolve(event.data);
    });
  });
}

function relayWebSocketProtocol(capability: string): string {
  return buildRelayWebSocketProtocol(capability);
}

export {
  relayWebSocketProtocol,
  runRelayClientCloseCleansDataScenario,
  runRelayLargeServerFrameScenario,
  runRelayHealthCheck,
  runRelayRoundtripScenario,
  waitForMessage,
};
export type { RelayTestHarness, TestSocket };
