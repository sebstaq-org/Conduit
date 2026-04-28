import { expect, it } from "vitest";
import { desktopPairingPresentation } from "./desktop-pairing-status";
import type { DesktopPairingStatusSnapshot } from "./desktop-pairing-status";

function mobileConnection(
  connectedClients: number,
): DesktopPairingStatusSnapshot["mobileConnection"] {
  if (connectedClients > 0) {
    return {
      connectionId: "conn_test",
      generation: 1,
      lastError: null,
      staleAt: "2026-04-25T00:00:45Z",
      status: "connected",
      transport: "relay",
      verifiedAt: "2026-04-25T00:00:00Z",
    };
  }
  return {
    connectionId: null,
    generation: null,
    lastError: null,
    staleAt: null,
    status: "idle",
    transport: "relay",
    verifiedAt: null,
  };
}

function healthyStatus(connectedClients: number): DesktopPairingStatusSnapshot {
  return {
    backendHealthy: true,
    mobileConnection: mobileConnection(connectedClients),
    pairingConfigured: true,
    presence: {
      clients: Array.from({ length: connectedClients }, (_value, index) => ({
        clientId: `client-${String(index)}`,
        connected: true,
        deviceKind: "mobile" as const,
        displayName: `Client ${String(index)}`,
        lastSeenAt: "2026-04-25T00:00:00Z",
        transport: "relay" as const,
      })),
      host: {
        displayName: "Conduit Desktop",
        serverId: "srv_host",
      },
    },
    relayConfigured: true,
    running: true,
  };
}

it("keeps unknown desktop daemon state visually idle", () => {
  // Per user contract: desktop must not imply active connection work when it has not checked status.
  // Do not change without an explicit product decision.
  expect(
    desktopPairingPresentation({
      actionError: null,
      offerReady: false,
      pending: null,
      status: null,
    }),
  ).toMatchObject({
    indicator: "idle",
    recoveryVisible: false,
    showMobilePairing: true,
  });
});

it("keeps pairing link readiness separate from mobile peer connection", () => {
  // Per user contract: showing a QR/link is not evidence that a phone connected.
  // Do not change without an explicit product decision.
  expect(
    desktopPairingPresentation({
      actionError: null,
      offerReady: true,
      pending: null,
      status: healthyStatus(0),
    }),
  ).toMatchObject({
    indicator: "idle",
    recoveryVisible: false,
    showMobilePairing: true,
  });
});

it("turns green only when backend reports a real mobile peer", () => {
  // Per user contract: desktop green means a verified mobile peer exists, not daemon health.
  // Do not change without an explicit product decision.
  expect(
    desktopPairingPresentation({
      actionError: null,
      offerReady: true,
      pending: null,
      status: healthyStatus(1),
    }),
  ).toMatchObject({
    indicator: "connected",
    connectedClientCount: 1,
    recoveryVisible: false,
    showMobilePairing: true,
  });
});

it("keeps desktop gray when only stale presence clients exist", () => {
  // Per user contract: desktop green requires at least one connected external client.
  // Do not change without an explicit product decision.
  expect(
    desktopPairingPresentation({
      actionError: null,
      offerReady: true,
      pending: null,
      status: Object.assign(healthyStatus(0), {
        presence: {
          clients: [
            {
              clientId: "client-stale",
              connected: false,
              deviceKind: "mobile",
              displayName: "Base iPhone",
              lastSeenAt: "2026-04-25T00:00:00Z",
              transport: "relay",
            },
          ],
          host: {
            displayName: "Conduit Desktop",
            serverId: "srv_host",
          },
        },
      }),
    }),
  ).toMatchObject({
    connectedClientCount: 0,
    indicator: "idle",
    recoveryVisible: false,
    showMobilePairing: true,
  });
});

it("surfaces recovery controls instead of daemon copy when backend is unavailable", () => {
  // Per user contract: daemon details stay hidden unless recovery is needed.
  // Do not change without an explicit product decision.
  expect(
    desktopPairingPresentation({
      actionError: null,
      offerReady: false,
      pending: null,
      status: {
        backendHealthy: false,
        mobileConnection: {
          connectionId: null,
          generation: null,
          lastError: null,
          staleAt: null,
          status: "idle",
          transport: "relay",
          verifiedAt: null,
        },
        pairingConfigured: false,
        presence: null,
        relayConfigured: true,
        running: true,
      },
    }),
  ).toMatchObject({
    indicator: "disconnected",
    recoveryVisible: true,
    showMobilePairing: false,
  });
});

it("turns red on explicit pairing action failure", () => {
  // Per user contract: red on desktop means the pairing surface failed, not that no phone is paired.
  // Do not change without an explicit product decision.
  expect(
    desktopPairingPresentation({
      actionError: "pairing failed",
      offerReady: false,
      pending: null,
      status: healthyStatus(0),
    }),
  ).toMatchObject({
    indicator: "disconnected",
    recoveryVisible: true,
    showMobilePairing: true,
  });
});
