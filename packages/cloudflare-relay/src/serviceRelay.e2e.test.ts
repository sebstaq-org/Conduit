import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  restartRelayServiceRun,
  startRelayServiceRun,
  stopRelayServiceRun,
} from "./serviceRelayProcess.js";
import { runRelaySessionMutationScenario } from "./serviceRelayMutationScenario.js";
import { expectExpiredHandshakeRejected } from "./serviceRelayExpiredHandshake.js";
import {
  expectDaemonStatusInvariant,
  expectPresenceConnected,
  fetchOffer,
  mobilePresence,
  onceExit,
  rejectsWithin,
  runLiveServicePresenceSmoke,
  runLiveServiceReconnectChurn,
  runServiceRelayScenario,
} from "./serviceRelayE2eScenarios.js";
import { bundleWorkerScript, waitForHealth } from "./serviceRelayTestUtils.js";
import { createRelaySessionClient } from "@conduit/session-client";
import type { RelayServiceE2eState } from "./serviceRelayE2eScenarios.js";

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
const e2eState: RelayServiceE2eState = { currentRun: null };

describe("service-bin relay runtime e2e", () => {
  afterEach(async () => {
    await stopRelayServiceRun(e2eState.currentRun);
    e2eState.currentRun = null;
    await currentMiniflare?.dispose();
    currentMiniflare = null;
  });

  it("runs real session commands through relay and reconnects after data close", async () => {
    const relayEndpoint = await startLocalRelayServer();
    await runServiceRelayScenario(e2eState, relayEndpoint, adminToken);
  }, 120000);

  it("runs ACP-sensitive session mutation commands through relay", async () => {
    const relayEndpoint = await startLocalRelayServer();
    e2eState.currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(e2eState.currentRun.port);
    await runRelaySessionMutationScenario(
      await fetchOffer(e2eState.currentRun.port),
    );
  }, 120000);

  it("reports product presence only after a client heartbeat", async () => {
    // Per user contract: desktop may turn Mobile pairing green only from this backend signal.
    // Do not change without an explicit product decision.
    const relayEndpoint = await startLocalRelayServer();
    e2eState.currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(e2eState.currentRun.port);
    await expectPresenceConnected(e2eState.currentRun.port, false);

    const offer = await fetchOffer(e2eState.currentRun.port);
    const client = createRelaySessionClient({ offer });
    await expect(client.getSettings()).resolves.toMatchObject({});
    await expectPresenceConnected(e2eState.currentRun.port, false);
    await expect(
      client.updatePresence(mobilePresence()),
    ).resolves.toBeUndefined();
    await expectPresenceConnected(e2eState.currentRun.port, true);

    client.close();
  }, 120000);

  it("keeps daemon status coherent through repeated relay reconnects", async () => {
    const relayEndpoint = await startLocalRelayServer();
    e2eState.currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(e2eState.currentRun.port);
    const offer = await fetchOffer(e2eState.currentRun.port);

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
      await expectDaemonStatusInvariant(e2eState.currentRun.port, true);
      client.close();
      await expectDaemonStatusInvariant(e2eState.currentRun.port, false);
    }
  }, 180000);

  it("recovers the same relay client object after backend restart", async () => {
    const relayEndpoint = await startLocalRelayServer();
    e2eState.currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(e2eState.currentRun.port);
    const offer = await fetchOffer(e2eState.currentRun.port);
    const client = createRelaySessionClient({ offer });

    await expect(
      client.updatePresence(mobilePresence()),
    ).resolves.toBeUndefined();
    await expect(client.getSettings()).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(e2eState.currentRun.port, true);

    e2eState.currentRun.service.kill();
    await onceExit(e2eState.currentRun.service);
    await expect(
      rejectsWithin(client.getSettings(), relayCommandRejectWindowMs),
    ).resolves.toMatch(/relay websocket|relay command timed out/u);

    e2eState.currentRun = await restartRelayServiceRun(
      e2eState.currentRun,
      relayEndpoint,
    );
    await waitForHealth(e2eState.currentRun.port);
    await expect(
      client.updatePresence(mobilePresence()),
    ).resolves.toBeUndefined();
    await expect(client.getSettings()).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(e2eState.currentRun.port, true);
    client.close();
    await expectDaemonStatusInvariant(e2eState.currentRun.port, false);
  }, 180000);

  it("converges same-offer overlap to one active relay client", async () => {
    const relayEndpoint = await startLocalRelayServer();
    e2eState.currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(e2eState.currentRun.port);
    const offer = await fetchOffer(e2eState.currentRun.port);

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
    await expectDaemonStatusInvariant(e2eState.currentRun.port, true);

    for (const client of clients) {
      client.close();
    }
    winner.close();
    await expectDaemonStatusInvariant(e2eState.currentRun.port, false);
  }, 180000);

  it("rejects a relay handshake delayed until after offer expiry", async () => {
    const relayEndpoint = await startLocalRelayServer();
    e2eState.currentRun = await startRelayServiceRun(relayEndpoint);
    await waitForHealth(e2eState.currentRun.port);
    const offer = await fetchOffer(e2eState.currentRun.port);
    await expectExpiredHandshakeRejected({
      adminToken,
      offer,
      relayEndpoint,
      state: e2eState,
    });
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
        e2eState,
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
      await runLiveServicePresenceSmoke(e2eState, liveRelayEndpoint ?? "");
    },
    120000,
  );

  liveEndpointIt(
    "survives deployed Cloudflare relay reconnect churn",
    async () => {
      await runLiveServiceReconnectChurn(e2eState, liveRelayEndpoint ?? "");
    },
    180000,
  );
});

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
