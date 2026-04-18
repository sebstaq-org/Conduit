import {
  acceptRelayClientHandshake,
  buildRelayWebSocketUrl,
  createRelayClientHandshake,
  deriveRelayConnectionId,
  deriveRelayServerId,
  generateRelayDaemonKeyPair,
  generateRelayCapability,
  parseRelayEnvelope,
} from "@conduit/relay-transport";
import { expect } from "vitest";

import { waitForMessage } from "./relayTestHarness.js";
import type { RelayTestHarness } from "./relayTestHarness.js";

async function runRelayAdversarialScenario(
  harness: RelayTestHarness,
  suffix: string,
): Promise<void> {
  const daemonCapability = generateRelayCapability();
  const clientCapability = generateRelayCapability();
  const attackerCapability = generateRelayCapability();
  const serverId = deriveRelayServerId(daemonCapability);
  const connectionId = deriveRelayConnectionId(clientCapability);
  const context = {
    connectionId,
    offerNonce: "EjRWeBI0VngSNFZ4EjRWeA",
    serverId,
  };
  const daemonKeys = generateRelayDaemonKeyPair();
  const controlUrl = buildRelayWebSocketUrl(harness.endpoint, {
    capability: daemonCapability,
    role: "server",
    serverId,
  });
  const control = await harness.openSocket(controlUrl, daemonCapability);

  await harness.openRejectedSocket(controlUrl, attackerCapability);

  const clientWaiting = waitForMessage(control, "attack control");
  const clientUrl = buildRelayWebSocketUrl(harness.endpoint, {
    capability: clientCapability,
    connectionId,
    role: "client",
    serverId,
  });
  const client = await harness.openSocket(clientUrl, clientCapability);
  expect(parseRelayEnvelope(await clientWaiting)).toMatchObject({
    connectionId,
    type: "client_waiting",
  });

  await harness.openRejectedSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      capability: attackerCapability,
      connectionId,
      role: "client",
      serverId,
    }),
    attackerCapability,
  );
  await harness.openRejectedSocket(clientUrl, clientCapability);

  const clientHandshake = await createRelayClientHandshake({
    context,
    daemonPublicKeyB64: daemonKeys.publicKeyB64,
  });
  const firstCipherFrame = await clientHandshake.channel.encryptUtf8(
    `PLAINTEXT_ATTACK_CLIENT_${suffix}_DO_NOT_LEAK`,
  );
  const rawHandshake = JSON.stringify(clientHandshake.handshake);
  const rawFirstCipherFrame = JSON.stringify(firstCipherFrame);
  client.send(rawHandshake);
  client.send(rawFirstCipherFrame);

  const dataUrl = buildRelayWebSocketUrl(harness.endpoint, {
    capability: daemonCapability,
    connectionId,
    role: "server",
    serverId,
  });
  await harness.openRejectedSocket(dataUrl, attackerCapability);

  const data = await harness.openSocket(dataUrl, daemonCapability);
  await expect(waitForMessage(data, "attack handshake")).resolves.toBe(
    rawHandshake,
  );
  const rawAtDaemon = await waitForMessage(data, "attack first cipher");
  expect(rawAtDaemon).toBe(rawFirstCipherFrame);

  const daemonChannel = await acceptRelayClientHandshake({
    context,
    daemonSecretKeyB64: daemonKeys.secretKeyB64,
    handshake: JSON.parse(rawHandshake) as typeof clientHandshake.handshake,
  });
  await expect(
    daemonChannel.decryptUtf8(
      JSON.parse(rawAtDaemon) as typeof firstCipherFrame,
    ),
  ).resolves.toBe(`PLAINTEXT_ATTACK_CLIENT_${suffix}_DO_NOT_LEAK`);

  const serverFrame = await daemonChannel.encryptUtf8(
    `PLAINTEXT_ATTACK_SERVER_${suffix}_DO_NOT_LEAK`,
  );
  const rawServerFrame = JSON.stringify(serverFrame);
  data.send(rawServerFrame);
  await expect(waitForMessage(client, "attack server cipher")).resolves.toBe(
    rawServerFrame,
  );

  data.close();
  client.close();
  control.close();
}

export { runRelayAdversarialScenario };
