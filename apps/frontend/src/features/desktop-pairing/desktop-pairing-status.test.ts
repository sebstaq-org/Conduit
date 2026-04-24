import { expect, it } from "vitest";
import { desktopPairingPresentation } from "./desktop-pairing-status";
import type { DesktopPairingStatusSnapshot } from "./desktop-pairing-status";

function healthyStatus(
  mobilePeerConnected: boolean,
): DesktopPairingStatusSnapshot {
  return {
    backendHealthy: true,
    mobilePeerConnected,
    pairingConfigured: true,
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
      status: healthyStatus(false),
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
      status: healthyStatus(true),
    }),
  ).toMatchObject({
    indicator: "connected",
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
        mobilePeerConnected: false,
        pairingConfigured: false,
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
      status: healthyStatus(false),
    }),
  ).toMatchObject({
    indicator: "disconnected",
    recoveryVisible: true,
    showMobilePairing: true,
  });
});
