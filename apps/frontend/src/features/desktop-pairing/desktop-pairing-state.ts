import { useState } from "react";
import type {
  ConduitDesktopBridge,
  DesktopDaemonStatus,
  DesktopPairingOffer,
} from "@/app-state/desktop-bridge";

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

const presencePollIntervalMs = 750;
const presencePollDeadlineMs = 120_000;

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

function schedulePresencePolling(
  bridge: ConduitDesktopBridge,
  setStatus: (value: DesktopDaemonStatus) => void,
): void {
  const startedAt = Date.now();
  const poll = async (): Promise<void> => {
    try {
      const next = await bridge.getDaemonStatus();
      setStatus(next);
      if (Date.now() - startedAt >= presencePollDeadlineMs) {
        return;
      }
    } catch {
      return;
    }
    setTimeout(() => {
      void poll();
    }, presencePollIntervalMs);
  };
  setTimeout(() => {
    void poll();
  }, presencePollIntervalMs);
}

function useDesktopPairingState(
  bridge: ConduitDesktopBridge | null,
): DesktopPairingState {
  const [status, setStatus] = useState<DesktopDaemonStatus | null>(null);
  const [offer, setOffer] = useState<DesktopPairingOffer | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const run = (action: PendingAction, task: () => Promise<void>): void => {
    runDesktopAction({ action, setActionError, setPending, task });
  };
  const handleStatus = (): void => {
    if (bridge !== null) {
      run("status", async () => {
        setStatus(await bridge.getDaemonStatus());
      });
    }
  };
  const handleOffer = (): void => {
    if (bridge !== null) {
      run("offer", async () => {
        setOffer(await bridge.getPairingOffer());
        setStatus(await bridge.getDaemonStatus());
        schedulePresencePolling(bridge, setStatus);
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
        setStatus(await bridge.restartDaemon());
        setOffer(null);
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
