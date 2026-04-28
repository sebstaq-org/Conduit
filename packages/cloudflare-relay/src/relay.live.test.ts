import { describe, expect, it } from "vitest";

import { runRelayAdversarialScenario } from "./relayAdversarialHarness.js";
import {
  relayWebSocketProtocol,
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
    openRejectedSocket: (url: string, capability?: string): Promise<void> =>
      openRejectedLiveSocket(url, capability),
    openSocket: (url: string, capability: string): Promise<TestSocket> =>
      openLiveSocket(url, capability),
  };
}

function openLiveSocket(url: string, capability: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, relayWebSocketProtocol(capability));
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

function openRejectedLiveSocket(
  url: string,
  capability?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol =
      capability === undefined ? undefined : relayWebSocketProtocol(capability);
    const socket = new WebSocket(url, protocol);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("timed out waiting for live relay rejection"));
    }, 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("live relay websocket unexpectedly opened"));
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      resolve();
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
      await runRelayRoundtripScenario(harness, `live_${Date.now()}`, {
        reconnect: false,
      });
      await runRelayAdversarialScenario(harness, `live_attack_${Date.now()}`);
    }, 30000);
  });
}
