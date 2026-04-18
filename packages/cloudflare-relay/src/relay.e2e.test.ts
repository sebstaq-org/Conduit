import { afterEach, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { MAX_FRAME_BYTES } from "./limits.js";
import {
  runRelayHealthCheck,
  runRelayRoundtripScenario,
} from "./relayTestHarness.js";
import type { RelayTestHarness, TestSocket } from "./relayTestHarness.js";

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

  it("closes oversized buffered client frames", async () => {
    const harness = await createLocalHarness();
    const client = await harness.openSocket(
      `${endpoint}/v1/relay/srv_limit?role=client&connectionId=conn_limit`,
    );

    client.send("x".repeat(MAX_FRAME_BYTES + 1));

    await expect(waitForClose(client)).resolves.toBeGreaterThan(0);
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
    openSocket: async (url: string): Promise<TestSocket> => {
      const dispatchUrl = websocketUrlToHttp(url);
      const response = await currentMiniflare?.dispatchFetch(dispatchUrl, {
        headers: { Upgrade: "websocket" },
      });
      if (response === undefined || response.status !== 101) {
        let body = "missing response";
        if (response !== undefined) {
          body = await response.text();
        }
        throw new Error(
          `local relay websocket failed with ${response?.status}: ${body}`,
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
