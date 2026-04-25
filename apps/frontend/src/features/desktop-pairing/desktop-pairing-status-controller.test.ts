import { afterEach, expect, it, vi } from "vitest";
import {
  createDesktopPairingStatusController,
  presencePollIntervalMs,
} from "./desktop-pairing-status-controller";
import type {
  ConduitDesktopBridge,
  DesktopDaemonStatus,
  DesktopPresenceSnapshot,
} from "@/app-state/desktop-bridge";
import type { DesktopPairingStatusController } from "./desktop-pairing-status-controller";

type GetDaemonStatus = ConduitDesktopBridge["getDaemonStatus"];

interface PollingSetup {
  readonly bridge: ConduitDesktopBridge;
  readonly controller: DesktopPairingStatusController;
  readonly getDaemonStatus: ReturnType<typeof vi.fn<GetDaemonStatus>>;
  readonly unsubscribe: () => void;
}

interface StaleStatusSetup {
  readonly bridge: ConduitDesktopBridge;
  readonly controller: DesktopPairingStatusController;
  readonly oldStatus: PromiseWithResolvers<DesktopDaemonStatus>;
  readonly unsubscribe: () => void;
}

function presenceClients(connectedClients: number): DesktopPresenceSnapshot {
  return {
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
  };
}

function healthyStatus(connectedClients: number): DesktopDaemonStatus {
  const presence = presenceClients(connectedClients);
  return {
    appBaseUrl: "conduit://pair",
    backendHealthy: true,
    daemon: {
      mobilePeerConnected: connectedClients > 0,
      pairingConfigured: true,
      presence,
      relayEndpoint: "ws://relay.test",
      serverId: "srv_host",
    },
    lastExit: null,
    mobilePeerConnected: connectedClients > 0,
    pairingConfigured: true,
    pid: 123,
    presence,
    relayConfigured: true,
    relayEndpoint: "ws://relay.test",
    restartCount: 0,
    running: true,
    sessionWsUrl: "ws://127.0.0.1/session",
  };
}

function createBridge(getDaemonStatus: GetDaemonStatus): ConduitDesktopBridge {
  return {
    copyText: vi.fn<ConduitDesktopBridge["copyText"]>(async () => {
      await Promise.resolve();
      return true;
    }),
    getDaemonStatus,
    getPairingOffer: vi.fn<ConduitDesktopBridge["getPairingOffer"]>(
      async () => {
        await Promise.resolve();
        throw new Error("not needed in this test");
      },
    ),
    restartDaemon: vi.fn<ConduitDesktopBridge["restartDaemon"]>(async () => {
      await Promise.resolve();
      return healthyStatus(0);
    }),
  };
}

function createPollingSetup(): PollingSetup {
  const controller = createDesktopPairingStatusController();
  const getDaemonStatus = vi.fn<GetDaemonStatus>(async () => {
    await Promise.resolve();
    return healthyStatus(0);
  });
  const bridge = createBridge(getDaemonStatus);
  return {
    bridge,
    controller,
    getDaemonStatus,
    unsubscribe: controller.subscribe(bridge, vi.fn<() => void>()),
  };
}

function restartPresencePolling(setup: PollingSetup): void {
  setup.controller.startPresencePolling(setup.bridge);
  setup.controller.startPresencePolling(setup.bridge);
}

function expectMobilePeerConnected(status: DesktopDaemonStatus | null): void {
  if (status === null) {
    throw new Error("expected desktop status snapshot");
  }
  expect(status).toMatchObject({ mobilePeerConnected: true });
}

function createStaleStatusSetup(): StaleStatusSetup {
  const controller = createDesktopPairingStatusController();
  const oldStatus = Promise.withResolvers<DesktopDaemonStatus>();
  const getDaemonStatus = vi.fn<GetDaemonStatus>();
  getDaemonStatus.mockReturnValueOnce(oldStatus.promise);
  getDaemonStatus.mockResolvedValueOnce(healthyStatus(1));
  const bridge = createBridge(getDaemonStatus);
  return {
    bridge,
    controller,
    oldStatus,
    unsubscribe: controller.subscribe(bridge, vi.fn<() => void>()),
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

it("fetches daemon presence as soon as desktop UI subscribes", async () => {
  // Per user contract: desktop must discover an already connected phone without forcing a new pairing action.
  // Do not change without an explicit product decision.
  const controller = createDesktopPairingStatusController();
  const getDaemonStatus = vi.fn<GetDaemonStatus>(async () => {
    await Promise.resolve();
    return healthyStatus(1);
  });
  const unsubscribe = controller.subscribe(
    createBridge(getDaemonStatus),
    vi.fn<() => void>(),
  );

  await flushPromises();

  expect(getDaemonStatus.mock.calls).toHaveLength(1);
  expectMobilePeerConnected(controller.getSnapshot());
  unsubscribe();
});

it("drops stale daemon status responses from an older generation", async () => {
  // Per user contract: old polling/status responses must not overwrite newer desktop presence state.
  // Do not change without an explicit product decision.
  const setup = createStaleStatusSetup();

  await setup.controller.refreshStatus(setup.bridge);
  setup.oldStatus.resolve(healthyStatus(0));
  await flushPromises();

  expectMobilePeerConnected(setup.controller.getSnapshot());
  setup.unsubscribe();
});

it("keeps one owned presence polling loop and cancels it on unmount", async () => {
  // Per user contract: desktop presence polling is owned and cancellable, never a pile of orphan loops.
  // Do not change without an explicit product decision.
  vi.useFakeTimers();
  const setup = createPollingSetup();
  await flushPromises();
  restartPresencePolling(setup);
  expect(vi.getTimerCount()).toBe(1);

  await vi.advanceTimersByTimeAsync(presencePollIntervalMs);
  expect(setup.getDaemonStatus).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(1);
  setup.unsubscribe();
  expect(vi.getTimerCount()).toBe(0);
});
