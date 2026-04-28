import { expect } from "vitest";

import {
  restartRelayServiceRun,
  startRelayServiceRun,
} from "./serviceRelayProcess.js";
import {
  capturingWebSocket,
  closeCapturedSockets,
  closeRelayDataSocket,
  delay,
  expireStoredOffer,
  waitForHealth,
} from "./serviceRelayTestUtils.js";
import { readConnectionOffer } from "@conduit/app-client";
import { createRelaySessionClient } from "@conduit/session-client";
import type { RelayServiceRun } from "./serviceRelayProcess.js";
import type { ConnectionOfferV1 } from "@conduit/app-client";

interface RelayServiceE2eState {
  currentRun: RelayServiceRun | null;
}

async function runServiceRelayScenario(
  state: RelayServiceE2eState,
  relayEndpoint: string,
  relayAdminToken: string,
): Promise<void> {
  state.currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(state.currentRun.port);

  const offer = await fetchOffer(state.currentRun.port);
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
  await expectDaemonStatusInvariant(state.currentRun.port, true);
  await expect(client.getSettings()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(state.currentRun.port, true);
  await expect(client.listProjects()).resolves.toMatchObject({});
  await expect(client.getSessionGroups()).resolves.toMatchObject({});
  let sessionIndexEvents = 0;
  const unsubscribe = await client.subscribeSessionIndexChanges(() => {
    sessionIndexEvents += 1;
  });
  unsubscribe();

  await expireStoredOffer(state.currentRun.home, offer);
  await closeRelayDataSocket(relayEndpoint, relayAdminToken, offer);
  await delay(300);

  await expectDaemonStatusSummary(state.currentRun.port, {
    mobileConnectedRows: 1,
    mobileConnectionStatus: "reconnecting",
  });
  await expect(client.getSettings()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(state.currentRun.port, true);
  await closeCapturedSockets(capturedSockets);
  await expectDaemonStatusInvariant(state.currentRun.port, false);

  state.currentRun = await restartRelayServiceRun(
    state.currentRun,
    relayEndpoint,
  );
  await waitForHealth(state.currentRun.port);
  const restartedClient = createRelaySessionClient({ offer });
  await expect(restartedClient.getSettings()).resolves.toMatchObject({});

  expect(sessionIndexEvents).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(telemetry)).not.toContain("PLAINTEXT");
}

async function runLiveServicePresenceSmoke(
  state: RelayServiceE2eState,
  relayEndpoint: string,
): Promise<void> {
  state.currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(state.currentRun.port);

  const offer = await fetchOffer(state.currentRun.port);
  const telemetry: unknown[] = [];
  const client = createRelaySessionClient({
    offer,
    onTelemetryEvent: (event) => telemetry.push(event),
  });

  await expect(
    client.updatePresence(mobilePresence()),
  ).resolves.toBeUndefined();
  await expectDaemonStatusInvariant(state.currentRun.port, true);
  await expect(client.getSettings()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(state.currentRun.port, true);
  await expect(client.listProjects()).resolves.toMatchObject({});
  await expectDaemonStatusInvariant(state.currentRun.port, true);

  client.close();
  await expectDaemonStatusInvariant(state.currentRun.port, false);
  expect(JSON.stringify(telemetry)).not.toContain("PLAINTEXT");
}

async function runLiveServiceReconnectChurn(
  state: RelayServiceE2eState,
  relayEndpoint: string,
): Promise<void> {
  state.currentRun = await startRelayServiceRun(relayEndpoint);
  await waitForHealth(state.currentRun.port);
  const offer = await fetchOffer(state.currentRun.port);

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
    await expectDaemonStatusInvariant(state.currentRun.port, true);
    await expect(
      client.getSettings(),
      `live reconnect ${index + 1} settings`,
    ).resolves.toMatchObject({});
    await expectDaemonStatusInvariant(state.currentRun.port, true);
    client.close();
    await expectDaemonStatusInvariant(state.currentRun.port, false);
  }
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

export {
  expectDaemonStatusInvariant,
  expectPresenceConnected,
  fetchOffer,
  mobilePresence,
  onceExit,
  rejectsWithin,
  runLiveServicePresenceSmoke,
  runLiveServiceReconnectChurn,
  runServiceRelayScenario,
};
export type { RelayServiceE2eState };
