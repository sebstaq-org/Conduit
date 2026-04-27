import { afterEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { CLOSE_REPLACED, MAX_FRAME_BYTES } from "./limits.js";
import { runRelayAdversarialScenario } from "./relayAdversarialHarness.js";
import {
  relayWebSocketProtocol,
  runRelayClientCloseCleansDataScenario,
  runRelayHealthCheck,
  runRelayLargeServerFrameScenario,
  runRelayRoundtripScenario,
  waitForMessage,
} from "./relayTestHarness.js";
import type { RelayTestHarness, TestSocket } from "./relayTestHarness.js";
import {
  buildRelayWebSocketUrl,
  deriveRelayConnectionId,
  deriveRelayServerId,
  generateRelayCapability,
} from "@conduit/relay-transport";

const workerScriptPath = fileURLToPath(new URL("index.ts", import.meta.url));
const endpoint = "http://relay.local";
const require = createRequire(import.meta.url);

interface MiniflareRuntime {
  dispatchFetch(input: string, init?: RequestInit): Promise<Response>;
  dispose(): Promise<void>;
}

type MiniflareConstructor = new (
  options: Record<string, unknown>,
) => MiniflareRuntime;

const Miniflare = (require("miniflare") as { Miniflare: MiniflareConstructor })
  .Miniflare;

let currentMiniflare: MiniflareRuntime | null = null;

describe("cloudflare relay local e2e", () => {
  afterEach(async () => {
    await currentMiniflare?.dispose();
    currentMiniflare = null;
  });

  it("serves health through the worker", async () => {
    const harness = await createLocalHarness();

    await runRelayHealthCheck(harness);
  });

  it("routes encrypted relay traffic, buffering, and reconnects", async () => {
    const harness = await createLocalHarness();

    await runRelayRoundtripScenario(harness, "local_roundtrip");
  });

  it("routes large encrypted server frames for session snapshots", async () => {
    const harness = await createLocalHarness();

    await runRelayLargeServerFrameScenario(harness);
  }, 15000);

  it("closes daemon data sockets when the mobile client disconnects", async () => {
    const harness = await createLocalHarness();

    await runRelayClientCloseCleansDataScenario(harness);
  }, 15000);

  it("rejects relay socket hijacking without disturbing valid sockets", async () => {
    const harness = await createLocalHarness();

    await runRelayAdversarialScenario(harness, "local_attack");
  }, 15000);

  it("rejects query-param-only relay capabilities", async () => {
    const harness = await createLocalHarness();
    const daemonCapability = generateRelayCapability();
    const serverId = deriveRelayServerId(daemonCapability);
    const url = new URL(
      buildRelayWebSocketUrl(endpoint, {
        capability: daemonCapability,
        role: "server",
        serverId,
      }),
    );
    url.searchParams.set("capability", daemonCapability);

    await harness.openRejectedSocket(url.toString());
  });

  it("closes oversized buffered client frames", async () => {
    const harness = await createLocalHarness();
    const daemonCapability = generateRelayCapability();
    const clientCapability = generateRelayCapability();
    const serverId = deriveRelayServerId(daemonCapability);
    const connectionId = deriveRelayConnectionId(clientCapability);
    const client = await harness.openSocket(
      buildRelayWebSocketUrl(endpoint, {
        capability: clientCapability,
        connectionId,
        role: "client",
        serverId,
      }),
      clientCapability,
    );

    client.send("x".repeat(MAX_FRAME_BYTES + 1));

    await expect(waitForClose(client)).resolves.toBeGreaterThan(0);
  });

  it("replaces stale client sockets for the same relay connection", async () => {
    const harness = await createLocalHarness();
    const daemonCapability = generateRelayCapability();
    const clientCapability = generateRelayCapability();
    const serverId = deriveRelayServerId(daemonCapability);
    const connectionId = deriveRelayConnectionId(clientCapability);
    const clientUrl = buildRelayWebSocketUrl(endpoint, {
      capability: clientCapability,
      connectionId,
      role: "client",
      serverId,
    });
    const control = await harness.openSocket(
      buildRelayWebSocketUrl(endpoint, {
        capability: daemonCapability,
        role: "server",
        serverId,
      }),
      daemonCapability,
    );
    const firstWaiting = waitForMessage(control, "first client waiting");
    const firstClient = await harness.openSocket(clientUrl, clientCapability);
    await expect(firstWaiting).resolves.toContain(connectionId);

    const firstClientClosed = waitForClose(firstClient);
    const secondClient = await harness.openSocket(clientUrl, clientCapability);

    await expect(firstClientClosed).resolves.toBe(CLOSE_REPLACED);
    secondClient.send("replacement client frame");
    const data = await harness.openSocket(
      buildRelayWebSocketUrl(endpoint, {
        capability: daemonCapability,
        connectionId,
        role: "server",
        serverId,
      }),
      daemonCapability,
    );
    await expect(waitForMessage(data, "replacement client frame")).resolves.toBe(
      "replacement client frame",
    );
    data.close();
    secondClient.close();
    control.close();
  });
});

async function createLocalHarness(): Promise<RelayTestHarness> {
  const workerScript = await bundleWorkerScript();
  currentMiniflare = new Miniflare({
    compatibilityDate: "2026-04-18",
    durableObjects: {
      RELAY: "RelayDurableObject",
    },
    modules: true,
    script: workerScript,
  });
  return {
    endpoint,
    fetchJson: async (path: string): Promise<unknown> => {
      const response = await currentMiniflare?.dispatchFetch(
        `${endpoint}${path}`,
      );
      if (response === undefined) {
        throw new Error("local relay runtime is not initialized");
      }
      return response.json();
    },
    openRejectedSocket: async (
      url: string,
      capability?: string,
    ): Promise<void> => {
      const response = await dispatchWebSocket(url, capability);
      if (response.status === 101) {
        response.webSocket?.accept();
        response.webSocket?.close();
        throw new Error("local relay websocket unexpectedly opened");
      }
    },
    openSocket: async (
      url: string,
      capability: string,
    ): Promise<TestSocket> => {
      const response = await dispatchWebSocket(url, capability);
      if (response.status !== 101) {
        const body = await response.text();
        throw new Error(
          `local relay websocket failed with ${response.status}: ${body}`,
        );
      }
      const webSocket = response.webSocket;
      if (webSocket === null || webSocket === undefined) {
        throw new Error("local relay websocket response was missing webSocket");
      }
      webSocket.accept();
      return webSocket;
    },
  };
}

async function dispatchWebSocket(
  url: string,
  capability?: string,
): Promise<Response> {
  const headers = new Headers({ Upgrade: "websocket" });
  if (capability !== undefined) {
    headers.set("Sec-WebSocket-Protocol", relayWebSocketProtocol(capability));
  }
  const response = await currentMiniflare?.dispatchFetch(
    websocketUrlToHttp(url),
    { headers },
  );
  if (response === undefined) {
    throw new Error("local relay runtime is not initialized");
  }
  return response;
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

function websocketUrlToHttp(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === "wss:") {
    parsed.protocol = "https:";
  } else {
    parsed.protocol = "http:";
  }
  return parsed.toString();
}

function waitForClose(socket: TestSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("timed out waiting for relay close"));
    }, 5000);
    socket.addEventListener("close", (event: CloseEvent) => {
      clearTimeout(timeout);
      resolve(event.code);
    });
  });
}
