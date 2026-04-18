import { afterEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  startRelayServiceRun,
  stopRelayServiceRun,
} from "./serviceRelayProcess.js";
import { readConnectionOffer } from "@conduit/app-client";
import { createRelaySessionClient } from "@conduit/session-client";
import { deriveRelayConnectionId } from "@conduit/relay-transport";
import type { RelayServiceRun } from "./serviceRelayProcess.js";
import type { ConnectionOfferV1 } from "@conduit/app-client";

const workerScriptPath = fileURLToPath(new URL("index.ts", import.meta.url));
const require = createRequire(import.meta.url);
const Miniflare = (require("miniflare") as { Miniflare: MiniflareConstructor })
  .Miniflare;
const adminToken = "service-relay-e2e-token";
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
});

async function runServiceRelayScenario(
  relayEndpoint: string,
  relayAdminToken: string,
): Promise<void> {
  currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(currentRun.port);

  const offer = await fetchOffer(currentRun.port);
  const telemetry: unknown[] = [];
  const client = createRelaySessionClient({
    offer,
    onTelemetryEvent: (event) => telemetry.push(event),
  });

  await expect(client.getSettings()).resolves.toMatchObject({});
  await expect(client.listProjects()).resolves.toMatchObject({});
  await expect(client.getSessionGroups()).resolves.toMatchObject({});
  let sessionIndexEvents = 0;
  const unsubscribe = await client.subscribeSessionIndexChanges(() => {
    sessionIndexEvents += 1;
  });
  unsubscribe();

  await closeRelayDataSocket(relayEndpoint, relayAdminToken, offer);
  await delay(300);

  await expect(client.getSettings()).resolves.toMatchObject({});
  expect(sessionIndexEvents).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(telemetry)).not.toContain("PLAINTEXT");
}

async function startLocalRelayServer(): Promise<string> {
  const workerScript = await bundleWorkerScript();
  currentMiniflare = new Miniflare({
    bindings: {
      CONDUIT_RELAY_TEST_ADMIN_TOKEN: adminToken,
    },
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

async function closeRelayDataSocket(
  relayEndpoint: string,
  relayAdminToken: string,
  offer: ConnectionOfferV1,
): Promise<void> {
  const connectionId = deriveRelayConnectionId(offer.relay.clientCapability);
  const url = new URL(`${relayEndpoint}/__conduit_test/close-data`);
  url.searchParams.set("serverId", offer.relay.serverId);
  url.searchParams.set("connectionId", connectionId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${relayAdminToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `close-data failed with ${response.status}: ${await response.text()}`,
    );
  }
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(100);
    }
  }
  throw new Error("service-bin did not become healthy");
}

async function bundleWorkerScript(): Promise<string> {
  const result = await build({
    bundle: true,
    entryPoints: [workerScriptPath],
    format: "esm",
    platform: "browser",
    write: false,
  });
  const output = result.outputFiles[0]?.text;
  if (output === undefined) {
    throw new Error("cloudflare relay worker bundle was not produced");
  }
  return output;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
