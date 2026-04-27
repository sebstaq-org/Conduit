import {
  acceptRelayClientHandshake,
  buildRelayWebSocketUrl,
  createRelayClientHandshake,
  deriveRelayConnectionId,
  deriveRelayServerId,
  generateRelayCapability,
  generateRelayDaemonKeyPair,
  parseRelayEnvelope,
} from "@conduit/relay-transport";
import { expect } from "vitest";
import { waitForMessage } from "./relayTestHarnessCore.js";
import type { RelayTestHarness } from "./relayTestHarnessCore.js";

const largeSessionSnapshotPlaintext = `${"SESSION_OPEN_SNAPSHOT_".repeat(4096)}END`;

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

export { runRelayLargeServerFrameScenario };
