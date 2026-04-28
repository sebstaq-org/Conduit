import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  restartRelayServiceRun,
  startRelayServiceRun,
  stopRelayServiceRun,
} from "./serviceRelayProcess.js";
import { runRelaySessionMutationScenario } from "./serviceRelayMutationScenario.js";
import {
  bundleWorkerScript,
  capturingWebSocket,
  closeCapturedSockets,
  closeRelayDataSocket,
  delay,
  expectNoMessage,
  expireStoredOffer,
  openRawRelayClientSocket,
  waitForHealth,
  waitForRelayDataSocket,
} from "./serviceRelayTestUtils.js";
import { readConnectionOffer } from "@conduit/app-client";
import { createRelaySessionClient } from "@conduit/session-client";
import {
  createRelayClientHandshake,
  deriveRelayConnectionId,
} from "@conduit/relay-transport";
import type { RelayServiceRun } from "./serviceRelayProcess.js";
import type { ConnectionOfferV1 } from "@conduit/app-client";

const productionWorkerScriptPath = fileURLToPath(
  new URL("index.ts", import.meta.url),
);
const testWorkerScriptPath = fileURLToPath(
  new URL("testIndex.ts", import.meta.url),
);
const require = createRequire(import.meta.url);
const Miniflare = (require("miniflare") as { Miniflare: MiniflareConstructor })
  .Miniflare;
const adminToken = "service-relay-e2e-token";
const relayCommandRejectWindowMs = 35_000;
const liveRelayEndpoint = process.env.CONDUIT_RELAY_LIVE_ENDPOINT;
const liveRelayAdminToken = process.env.CONDUIT_RELAY_TEST_ADMIN_TOKEN;

interface MiniflareRuntime {
  readonly ready: Promise<URL>;
  dispose(): Promise<void>;
}

type MiniflareConstructor = new (
  options: Record<string, unknown>,
) => MiniflareRuntime;

let currentMiniflare: MiniflareRuntime | null = null;
let currentRun: RelayServiceRun | null = null;

describe("service-bin relay runtime e2e", () => {
  afterEach(async () => {
    await stopRelayServiceRun(currentRun);
    currentRun = null;
    await currentMiniflare?.dispose();
    currentMiniflare = null;
  });

  it("runs real session commands through relay and reconnects after data close", async () => {
    const relayEndpoint = await startLocalRelayServer();
    await runServiceRelayScenario(relayEndpoint, adminToken);
  }, 120000);

  it("runs ACP-sensitive session mutation commands through relay", async () => {
    const relayEndpoint = await startLocalRelayServer();
    currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(currentRun.port);
    await runRelaySessionMutationScenario(await fetchOffer(currentRun.port));
  }, 120000);

  it("reports product presence only after a client heartbeat", async () => {
    // Per user contract: desktop may turn Mobile pairing green only from this backend signal.
    // Do not change without an explicit product decision.
    const relayEndpoint = await startLocalRelayServer();
    currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(currentRun.port);
    await expectPresenceConnected(currentRun.port, false);

    const offer = await fetchOffer(currentRun.port);
    const client = createRelaySessionClient({ offer });
    await expect(client.getSettings()).resolves.toMatchObject({});
    await expectPresenceConnected(currentRun.port, false);
    await expect(
      client.updatePresence(mobilePresence()),
    ).resolves.toBeUndefined();
    await expectPresenceConnected(currentRun.port, true);

    client.close();
  }, 120000);

  it("keeps daemon status coherent through repeated relay reconnects", async () => {
    const relayEndpoint = await startLocalRelayServer();
    currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(currentRun.port);
    const offer = await fetchOffer(currentRun.port);

    for (let index = 0; index < 20; index += 1) {
      const client = createRelaySessionClient({ offer });
      await expect(
        client.updatePresence({
          clientId: "service-relay-reconnect-mobile",
          deviceKind: "mobile",
          displayName: "Reconnect Mobile",
        }),
      ).resolves.toBeUndefined();
      await expect(client.getSettings()).resolves.toMatchObject({});
      await expectDaemonStatusInvariant(currentRun.port, true);
      client.close();
      await expectDaemonStatusInvariant(currentRun.port, false);
    }
  }, 180000);

  it("recovers the same relay client object after backend restart", async () => {
    const relayEndpoint = await startLocalRelayServer();
    currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(currentRun.port);
    const offer = await fetchOffer(currentRun.port);
    const client = createRelaySessionClient({ offer });

    await expect(
      client.updatePresence(mobilePresence()),
    ).resolves.toBeUndefined();
    await expect(client.getSettings()).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(currentRun.port, true);

    currentRun.service.kill();
    await onceExit(currentRun.service);
    await expect(
      rejectsWithin(client.getSettings(), relayCommandRejectWindowMs),
    ).resolves.toMatch(/relay websocket|relay command timed out/u);

    currentRun = await restartRelayServiceRun(currentRun, relayEndpoint);
    await waitForHealth(currentRun.port);
    await expect(
      client.updatePresence(mobilePresence()),
    ).resolves.toBeUndefined();
    await expect(client.getSettings()).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(currentRun.port, true);
    client.close();
    await expectDaemonStatusInvariant(currentRun.port, false);
  }, 180000);

  it("converges same-offer overlap to one active relay client", async () => {
    const relayEndpoint = await startLocalRelayServer();
    currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(currentRun.port);
    const offer = await fetchOffer(currentRun.port);

    const clients = Array.from({ length: 6 }, () =>
      createRelaySessionClient({ offer }),
    );
    const results = await Promise.allSettled(
      clients.map(async (client, index) => {
        await client.updatePresence({
          clientId: `service-relay-overlap-${index + 1}`,
          deviceKind: "mobile",
          displayName: `Overlap ${index + 1}`,
        });
        await client.getSettings();
      }),
    );
    expect(JSON.stringify(results)).not.toContain(
      "relay websocket failed to connect",
    );
    const winner = createRelaySessionClient({ offer });
    await expect(
      winner.updatePresence({
        clientId: "service-relay-overlap-winner",
        deviceKind: "mobile",
        displayName: "Overlap Winner",
      }),
    ).resolves.toBeUndefined();
    await expect(winner.getSettings()).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(currentRun.port, true);

    for (const client of clients) {
      client.close();
    }
    winner.close();
    await expectDaemonStatusInvariant(currentRun.port, false);
  }, 180000);

  it("rejects a relay handshake delayed until after offer expiry", async () => {
    const relayEndpoint = await startLocalRelayServer();
    currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(currentRun.port);
    const offer = await fetchOffer(currentRun.port);
    const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
    const clientSocket = await openRawRelayClientSocket(relayEndpoint, offer);
    await waitForRelayDataSocket(relayEndpoint, adminToken, offer);
    await expireStoredOffer(currentRun.home, offer);

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
      JSON.stringify({
        v: 1,
        type: "command",
        id: command.id,
        command,
      }),
    );

    clientSocket.send(JSON.stringify(handshake.handshake));
    clientSocket.send(JSON.stringify(encryptedCommand));

    await expectNoMessage(clientSocket, 1000);
    clientSocket.close();
  }, 120000);

  it("keeps the production worker test-admin route unavailable", async () => {
    const relayEndpoint = await startLocalProductionRelayServer();
    const response = await fetch(`${relayEndpoint}/__conduit_test/close-data`);

    expect(response.status).toBe(404);
  }, 120000);

  const liveIt =
    liveRelayEndpoint !== undefined && liveRelayAdminToken !== undefined
      ? it
      : it.skip;
  liveIt(
    "runs real session commands through the deployed Cloudflare relay",
    async () => {
      await runServiceRelayScenario(
        liveRelayEndpoint ?? "",
        liveRelayAdminToken ?? "",
      );
    },
    120000,
  );

  const liveEndpointIt = liveRelayEndpoint === undefined ? it.skip : it;
  liveEndpointIt(
    "keeps deployed Cloudflare relay presence connected across real commands",
    async () => {
      await runLiveServicePresenceSmoke(liveRelayEndpoint ?? "");
    },
    120000,
  );

  liveEndpointIt(
    "survives deployed Cloudflare relay reconnect churn",
    async () => {
      await runLiveServiceReconnectChurn(liveRelayEndpoint ?? "");
    },
    180000,
  );
});

async function runServiceRelayScenario(
  relayEndpoint: string,
  relayAdminToken: string,
): Promise<void> {
  currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(currentRun.port);

  const offer = await fetchOffer(currentRun.port);
  const telemetry: unknown[] = [];
  const capturedSockets: WebSocket[] = [];
  const client = createRelaySessionClient({
    offer,
    WebSocketImpl: capturingWebSocket(capturedSockets),
    onTelemetryEvent: (event) => telemetry.push(event),
  });

  await expect(
    client.updatePresence(mobilePresence()),
  ).resolves.toBeUndefined();
  await expectDaemonStatusInvariant(currentRun.port, true);
  await expect(client.getSettings()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(currentRun.port, true);
  await expect(client.listProjects()).resolves.toMatchObject({});
  await expect(client.getSessionGroups()).resolves.toMatchObject({});
  let sessionIndexEvents = 0;
  const unsubscribe = await client.subscribeSessionIndexChanges(() => {
    sessionIndexEvents += 1;
  });
  unsubscribe();

  await expireStoredOffer(currentRun.home, offer);

  await closeRelayDataSocket(relayEndpoint, relayAdminToken, offer);
  await delay(300);

  await expectDaemonStatusSummary(currentRun.port, {
    mobileConnectedRows: 1,
    mobileConnectionStatus: "reconnecting",
  });
  await expect(client.getSettings()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(currentRun.port, true);
  await closeCapturedSockets(capturedSockets);
  await expectDaemonStatusInvariant(currentRun.port, false);

  currentRun = await restartRelayServiceRun(currentRun, relayEndpoint);
  await waitForHealth(currentRun.port);
  const restartedClient = createRelaySessionClient({ offer });
  await expect(restartedClient.getSettings()).resolves.toMatchObject({});

  expect(sessionIndexEvents).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(telemetry)).not.toContain("PLAINTEXT");
}

async function runLiveServicePresenceSmoke(
  relayEndpoint: string,
): Promise<void> {
  currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(currentRun.port);

  const offer = await fetchOffer(currentRun.port);
  const telemetry: unknown[] = [];
  const client = createRelaySessionClient({
    offer,
    onTelemetryEvent: (event) => telemetry.push(event),
  });

  await expect(
    client.updatePresence(mobilePresence()),
  ).resolves.toBeUndefined();
  await expectDaemonStatusInvariant(currentRun.port, true);
  await expect(client.getSettings()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(currentRun.port, true);
  await expect(client.listProjects()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(currentRun.port, true);

  client.close();
  await expectDaemonStatusInvariant(currentRun.port, false);
  expect(JSON.stringify(telemetry)).not.toContain("PLAINTEXT");
}

async function runLiveServiceReconnectChurn(
  relayEndpoint: string,
): Promise<void> {
  currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(currentRun.port);
  const offer = await fetchOffer(currentRun.port);

  for (let index = 0; index < 20; index += 1) {
    const client = createRelaySessionClient({ offer });
    await expect(
      client.updatePresence({
        clientId: `live-reconnect-mobile-${index + 1}`,
        deviceKind: "mobile",
        displayName: `Live Reconnect ${index + 1}`,
      }),
      `live reconnect ${index + 1} presence update`,
    ).resolves.toBeUndefined();
    await expectDaemonStatusInvariant(currentRun.port, true);
    await expect(
      client.getSettings(),
      `live reconnect ${index + 1} settings`,
    ).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(currentRun.port, true);
    client.close();
    await expectDaemonStatusInvariant(currentRun.port, false);
  }
}

function startLocalRelayServer(): Promise<string> {
  return startMiniflareRelay(testWorkerScriptPath, {
    CONDUIT_RELAY_TEST_ADMIN_TOKEN: adminToken,
  });
}

function startLocalProductionRelayServer(): Promise<string> {
  return startMiniflareRelay(productionWorkerScriptPath, {});
}

async function startMiniflareRelay(
  scriptPath: string,
  bindings: Record<string, string>,
): Promise<string> {
  const workerScript = await bundleWorkerScript(scriptPath);
  currentMiniflare = new Miniflare({
    bindings,
    compatibilityDate: "2026-04-18",
    durableObjects: {
      RELAY: "RelayDurableObject",
    },
    host: "127.0.0.1",
    modules: true,
    port: 0,
    script: workerScript,
  });
  const ready = await currentMiniflare.ready;
  return ready.toString().replace(/\/$/, "");
}

async function fetchOffer(port: number): Promise<ConnectionOfferV1> {
  const response = await fetch(`http://127.0.0.1:${port}/api/pairing`);
  if (!response.ok) {
    throw new Error(
      `pairing failed with ${response.status}: ${await response.text()}`,
    );
  }
  const payload = (await response.json()) as { offer: unknown };
  return readConnectionOffer(payload.offer);
}

async function expectPresenceConnected(
  port: number,
  expected: boolean,
): Promise<void> {
  await expect
    .poll(() => fetchPresenceConnected(port), { timeout: 15000 })
    .toBe(expected);
}

async function expectDaemonStatusInvariant(
  port: number,
  expectedConnected: boolean,
): Promise<void> {
  await expectDaemonStatusSummary(port, {
    mobileConnectedRows: expectedConnected ? 1 : 0,
    mobileConnectionStatus: expectedConnected ? "connected" : "disconnected",
  });
}

async function expectDaemonStatusSummary(
  port: number,
  expected: {
    readonly mobileConnectedRows: number;
    readonly mobileConnectionStatus: string;
  },
): Promise<void> {
  await expect
    .poll(() => fetchDaemonStatusSummary(port), { timeout: 15000 })
    .toMatchObject(expected);
}

async function fetchPresenceConnected(port: number): Promise<boolean> {
  const summary = await fetchDaemonStatusSummary(port);
  return summary.mobileConnectedRows > 0;
}

async function fetchDaemonStatusSummary(port: number): Promise<{
  readonly mobileConnectionStatus: string;
  readonly mobileConnectedRows: number;
}> {
  const response = await fetch(`http://127.0.0.1:${port}/api/daemon/status`);
  if (!response.ok) {
    throw new Error(
      `daemon status failed with ${response.status}: ${await response.text()}`,
    );
  }
  const payload = (await response.json()) as {
    mobileConnection?: {
      status?: unknown;
    };
    presence?: {
      clients?: { connected?: unknown; deviceKind?: unknown }[];
    };
  };
  if (!Array.isArray(payload.presence?.clients)) {
    throw new TypeError("daemon status did not include presence clients");
  }
  if (typeof payload.mobileConnection?.status !== "string") {
    throw new TypeError(
      "daemon status did not include mobileConnection.status",
    );
  }
  const mobileConnectedRows = payload.presence.clients.filter(
    (client) => client.deviceKind === "mobile" && client.connected === true,
  ).length;
  return {
    mobileConnectionStatus: payload.mobileConnection.status,
    mobileConnectedRows,
  };
}

function onceExit(service: RelayServiceRun["service"]): Promise<void> {
  if (service.exitCode !== null || service.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    service.once("exit", () => {
      resolve();
    });
  });
}

async function rejectsWithin(
  promise: Promise<unknown>,
  ms: number,
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  try {
    await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`operation did not reject within ${ms}ms`));
        }, ms);
      }),
    ]);
  } catch (error) {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    return error instanceof Error ? error.message : String(error);
  }
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  throw new Error("operation unexpectedly resolved");
}

function mobilePresence(): {
  readonly clientId: string;
  readonly deviceKind: "mobile";
  readonly displayName: string;
} {
  return {
    clientId: "service-relay-e2e-mobile-client",
    deviceKind: "mobile",
    displayName: "E2E Mobile",
  };
}
