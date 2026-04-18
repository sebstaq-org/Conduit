import { describe, expect, it } from "vitest";

import {
  runRelayHealthCheck,
  runRelayRoundtripScenario,
} from "./relayTestHarness.js";
import type { RelayTestHarness, TestSocket } from "./relayTestHarness.js";

const liveEndpoint = process.env.CONDUIT_RELAY_LIVE_ENDPOINT;

function createLiveHarness(endpoint: string): RelayTestHarness {
  return {
    endpoint,
    fetchJson: async (path: string): Promise<unknown> => {
      const response = await fetch(`${endpoint}${path}`);
      expect(response.ok).toBe(true);
      return response.json();
    },
    openSocket: (url: string): Promise<TestSocket> => openLiveSocket(url),
  };
}

function openLiveSocket(url: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("timed out opening live relay websocket"));
    }, 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("live relay websocket failed to open"));
    });
  });
}

if (liveEndpoint === undefined) {
  describe.skip("cloudflare relay live e2e", () => {
    it("requires CONDUIT_RELAY_LIVE_ENDPOINT", () => {
      expect(liveEndpoint).toBeUndefined();
    });
  });
} else {
  describe("cloudflare relay live e2e", () => {
    it("verifies the deployed Cloudflare relay with real WebSockets", async () => {
      const harness = createLiveHarness(liveEndpoint);

      await runRelayHealthCheck(harness);
      await runRelayRoundtripScenario(harness, `live_${Date.now()}`);
    }, 30000);
  });
}
