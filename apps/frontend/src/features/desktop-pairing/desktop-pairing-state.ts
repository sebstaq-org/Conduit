import { useCallback, useState, useSyncExternalStore } from "react";
import type {
  ConduitDesktopBridge,
  DesktopDaemonStatus,
  DesktopPairingOffer,
} from "@/app-state/desktop-bridge";
import { desktopPairingStatusController } from "./desktop-pairing-status-controller";

type PendingAction = "offer" | "restart" | "status" | null;

interface DesktopPairingState {
  readonly actionError: string | null;
  readonly handleCopy: () => void;
  readonly handleOffer: () => void;
  readonly handleRestart: () => void;
  readonly handleStatus: () => void;
  readonly offer: DesktopPairingOffer | null;
  readonly pending: PendingAction;
  readonly status: DesktopDaemonStatus | null;
}

interface DesktopActionRequest {
  readonly action: PendingAction;
  readonly setActionError: (value: string | null) => void;
  readonly setPending: (value: PendingAction) => void;
  readonly task: () => Promise<void>;
}

type SetDesktopPairingOffer = (value: DesktopPairingOffer | null) => void;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function executeDesktopAction(
  request: DesktopActionRequest,
): Promise<void> {
  request.setPending(request.action);
  request.setActionError(null);
  try {
    await request.task();
  } catch (error) {
    request.setActionError(errorMessage(error));
  } finally {
    request.setPending(null);
  }
}

function runDesktopAction(request: DesktopActionRequest): void {
  void executeDesktopAction(request);
}

async function createPairingOffer(
  bridge: ConduitDesktopBridge,
  setOffer: SetDesktopPairingOffer,
): Promise<void> {
  setOffer(await bridge.getPairingOffer());
  await desktopPairingStatusController.refreshStatus(bridge);
  desktopPairingStatusController.startPresencePolling(bridge);
}

async function restartDesktopDaemon(
  bridge: ConduitDesktopBridge,
  setOffer: SetDesktopPairingOffer,
): Promise<void> {
  desktopPairingStatusController.cancelPolling();
  desktopPairingStatusController.replaceStatus(await bridge.restartDaemon());
  desktopPairingStatusController.startBaselinePolling(bridge);
  setOffer(null);
}

function useDesktopStatus(
  bridge: ConduitDesktopBridge | null,
): DesktopDaemonStatus | null {
  const subscribe = useCallback(
    (listener: () => void) =>
      desktopPairingStatusController.subscribe(bridge, listener),
    [bridge],
  );
  return useSyncExternalStore(
    subscribe,
    () => desktopPairingStatusController.getSnapshot(),
    () => desktopPairingStatusController.getSnapshot(),
  );
}

function useDesktopPairingState(
  bridge: ConduitDesktopBridge | null,
): DesktopPairingState {
  const status = useDesktopStatus(bridge);
  const [offer, setOffer] = useState<DesktopPairingOffer | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const run = (action: PendingAction, task: () => Promise<void>): void => {
    runDesktopAction({ action, setActionError, setPending, task });
  };
  const handleStatus = (): void => {
    if (bridge !== null) {
      run("status", async () => {
        await desktopPairingStatusController.refreshStatus(bridge);
      });
    }
  };
  const handleOffer = (): void => {
    if (bridge !== null) {
      run("offer", async () => {
        await createPairingOffer(bridge, setOffer);
      });
    }
  };
  const handleCopy = (): void => {
    if (offer !== null && bridge !== null) {
      void bridge.copyText(offer.mobileUrl);
    }
  };
  const handleRestart = (): void => {
    if (bridge !== null) {
      run("restart", async () => {
        await restartDesktopDaemon(bridge, setOffer);
      });
    }
  };
  return {
    actionError,
    handleCopy,
    handleOffer,
    handleRestart,
    handleStatus,
    offer,
    pending,
    status,
  };
}

export { useDesktopPairingState };
export type { DesktopPairingState, PendingAction };
