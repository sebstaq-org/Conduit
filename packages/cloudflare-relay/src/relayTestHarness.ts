import {
  acceptRelayClientHandshake,
  buildRelayWebSocketUrl,
  createRelayClientHandshake,
  generateRelayDaemonKeyPair,
  parseRelayEnvelope,
} from "@conduit/relay-transport";
import { expect } from "vitest";

type TestSocket = Pick<WebSocket, "addEventListener" | "close" | "send">;

interface RelayTestHarness {
  readonly endpoint: string;
  readonly fetchJson: (path: string) => Promise<unknown>;
  readonly openSocket: (url: string) => Promise<TestSocket>;
}

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
): Promise<void> {
  const serverId = `srv_e2e_${suffix}`;
  const connectionId = `conn_${suffix}`;
  const context = {
    connectionId,
    offerNonce: "EjRWeBI0VngSNFZ4EjRWeA",
    serverId,
  };
  const daemonKeys = generateRelayDaemonKeyPair();
  const control = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, { role: "server", serverId }),
  );
  const client = await harness.openSocket(
    buildRelayWebSocketUrl(harness.endpoint, {
      connectionId,
      role: "client",
      serverId,
    }),
  );

  expect(parseRelayEnvelope(await waitForMessage(control))).toMatchObject({
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
      connectionId,
      role: "server",
      serverId,
    }),
  );
  await expect(waitForMessage(data)).resolves.toBe(rawHandshake);
  const rawAtDaemon = await waitForMessage(data);
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
  const rawAtClient = await waitForMessage(client);
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
      connectionId,
      role: "server",
      serverId,
    }),
  );
  const rawReconnectAtDaemon = await waitForMessage(dataReconnect);
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

async function waitForEnvelope(
  socket: TestSocket,
  type: "client_waiting" | "data_closed" | "client_closed",
  connectionId: string,
): Promise<void> {
  for (let attempts = 0; attempts < 6; attempts += 1) {
    const envelope = parseRelayEnvelope(await waitForMessage(socket));
    if (envelope.type === type && envelope.connectionId === connectionId) {
      return;
    }
  }
  throw new Error(`relay envelope ${type} for ${connectionId} not observed`);
}

function waitForMessage(socket: TestSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("timed out waiting for relay message"));
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

export { runRelayHealthCheck, runRelayRoundtripScenario, waitForMessage };
export type { RelayTestHarness, TestSocket };
