import { expect } from "vitest";

import {
  openRawRelayClientSocket,
  waitForRelayDataSocket,
  expectNoMessage,
  expireStoredOffer,
} from "./serviceRelayTestUtils.js";
import {
  createRelayClientHandshake,
  deriveRelayConnectionId,
} from "@conduit/relay-transport";
import type { RelayServiceE2eState } from "./serviceRelayE2eScenarios.js";
import type { ConnectionOfferV1 } from "@conduit/app-client";

interface ExpiredHandshakeScenario {
  readonly adminToken: string;
  readonly offer: ConnectionOfferV1;
  readonly relayEndpoint: string;
  readonly state: RelayServiceE2eState;
}

async function expectExpiredHandshakeRejected({
  adminToken,
  offer,
  relayEndpoint,
  state,
}: ExpiredHandshakeScenario): Promise<void> {
  const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
  const clientSocket = await openRawRelayClientSocket(relayEndpoint, offer);
  await waitForRelayDataSocket(relayEndpoint, adminToken, offer);
  if (state.currentRun === null) {
    throw new Error("relay service run is required for expired handshake test");
  }
  await expireStoredOffer(state.currentRun.home, offer);
  const handshake = await createRelayClientHandshake({
    context: {
      connectionId,
      offerNonce: offer.nonce,
      serverId: offer.relay.serverId,
    },
    daemonPublicKeyB64: offer.daemonPublicKeyB64,
  });
  const command = {
    command: "settings/get",
    id: "expired-handshake-settings",
    params: {},
    provider: "all",
  };
  const encryptedCommand = await handshake.channel.encryptUtf8(
    JSON.stringify({ command, id: command.id, type: "command", v: 1 }),
  );
  clientSocket.send(JSON.stringify(handshake.handshake));
  clientSocket.send(JSON.stringify(encryptedCommand));
  await expectNoMessage(clientSocket, 1000);
  clientSocket.close();
  expect(connectionId).toMatch(/^conn_/u);
}

export { expectExpiredHandshakeRejected };
