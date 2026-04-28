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
import { runRelayLargeServerFrameScenario } from "./relayLargeFrameScenario.js";
import { waitForMessage } from "./relayTestHarnessCore.js";
import type { RelayTestHarness, TestSocket } from "./relayTestHarnessCore.js";

const plaintextFromClient = "PLAINTEXT_CLIENT_MARKER_DO_NOT_LEAK";
const plaintextFromServer = "PLAINTEXT_SERVER_MARKER_DO_NOT_LEAK";
const reconnectPlaintext = "PLAINTEXT_RECONNECT_MARKER_DO_NOT_LEAK";

async function runRelayHealthCheck(harness: RelayTestHarness): Promise<void> {
  await expect(harness.fetchJson("/health")).resolves.toEqual({
    ok: true,
    service: "conduit-relay",
  });
}

async function runRelayRoundtripScenario(
  harness: RelayTestHarness,
  suffix: string,
  options: { reconnect?: boolean } = {},
): Promise<void> {
  const reconnect = options.reconnect ?? true;
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

  if (!reconnect) {
    client.close();
    control.close();
    return;
  }

  const reconnectClient = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: clientCapability,
      connectionId,
      role: "client",
      serverId: relayServerId,
    }),
    clientCapability,
  );
  await waitForEnvelope(control, "client_waiting", connectionId);
  const reconnectHandshake = await createRelayClientHandshake({
    context,
    daemonPublicKeyB64: daemonKeys.publicKeyB64,
  });
  const reconnectFrame =
    await reconnectHandshake.channel.encryptUtf8(reconnectPlaintext);
  const rawReconnectHandshake = JSON.stringify(reconnectHandshake.handshake);
  const rawReconnectFrame = JSON.stringify(reconnectFrame);
  expect(rawReconnectFrame).not.toContain(reconnectPlaintext);
  reconnectClient.send(rawReconnectHandshake);
  reconnectClient.send(rawReconnectFrame);
  const dataReconnect = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: daemonCapability,
      connectionId,
      role: "server",
      serverId: relayServerId,
    }),
    daemonCapability,
  );
  const rawReconnectHandshakeAtDaemon = await waitForMessage(
    dataReconnect,
    "roundtrip reconnect handshake",
  );
  expect(rawReconnectHandshakeAtDaemon).toBe(rawReconnectHandshake);
  const rawReconnectAtDaemon = await waitForMessage(
    dataReconnect,
    "roundtrip reconnect",
  );
  expect(rawReconnectAtDaemon).toBe(rawReconnectFrame);
  const reconnectDaemonChannel = await acceptRelayClientHandshake({
    context,
    daemonSecretKeyB64: daemonKeys.secretKeyB64,
    handshake: JSON.parse(
      rawReconnectHandshakeAtDaemon,
    ) as typeof reconnectHandshake.handshake,
  });
  await expect(
    reconnectDaemonChannel.decryptUtf8(
      JSON.parse(rawReconnectAtDaemon) as typeof reconnectFrame,
    ),
  ).resolves.toBe(reconnectPlaintext);

  dataReconnect.close();
  client.close();
  reconnectClient.close();
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

  client.send("client close probe");
  await expect(waitForMessage(data, "client close probe")).resolves.toBe(
    "client close probe",
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
