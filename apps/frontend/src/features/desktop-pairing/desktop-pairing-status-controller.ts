import type {
  ConduitDesktopBridge,
  DesktopDaemonStatus,
} from "@/app-state/desktop-bridge";

type DesktopPairingStatusListener = () => void;
type PollMode = "baseline" | "presence";

interface DesktopPairingStatusController {
  readonly cancelPolling: () => void;
  readonly getSnapshot: () => DesktopDaemonStatus | null;
  readonly refreshStatus: (
    bridge: ConduitDesktopBridge,
  ) => Promise<DesktopDaemonStatus>;
  readonly replaceStatus: (status: DesktopDaemonStatus) => void;
  readonly startBaselinePolling: (bridge: ConduitDesktopBridge) => void;
  readonly startPresencePolling: (bridge: ConduitDesktopBridge) => void;
  readonly subscribe: (
    bridge: ConduitDesktopBridge | null,
    listener: DesktopPairingStatusListener,
  ) => () => void;
}

interface PollContext {
  readonly bridge: ConduitDesktopBridge;
  readonly generation: number;
  readonly mode: PollMode;
  readonly startedAt: number;
}

const baselinePollIntervalMs = 5000;
const presencePollIntervalMs = 750;
const presencePollDeadlineMs = 120_000;

function pollIntervalMs(mode: PollMode): number {
  if (mode === "presence") {
    return presencePollIntervalMs;
  }
  return baselinePollIntervalMs;
}

function hasConnectedPresenceClient(status: DesktopDaemonStatus): boolean {
  return status.mobileConnection.status === "connected";
}

function createPollContext(
  bridge: ConduitDesktopBridge,
  mode: PollMode,
  generation: number,
): PollContext {
  return {
    bridge,
    generation,
    mode,
    startedAt: Date.now(),
  };
}

function presenceDeadlineReached(context: PollContext): boolean {
  return (
    context.mode === "presence" &&
    Date.now() - context.startedAt >= presencePollDeadlineMs
  );
}

class DesktopPairingStatusControllerImpl implements DesktopPairingStatusController {
  private readonly listeners = new Set<DesktopPairingStatusListener>();
  private bridge: ConduitDesktopBridge | null = null;
  private generation = 0;
  private mode: PollMode | null = null;
  private snapshot: DesktopDaemonStatus | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  cancelPolling(): void {
    this.clearTimer();
    this.generation += 1;
    this.mode = null;
  }

  getSnapshot(): DesktopDaemonStatus | null {
    return this.snapshot;
  }

  async refreshStatus(
    nextBridge: ConduitDesktopBridge,
  ): Promise<DesktopDaemonStatus> {
    this.adoptBridge(nextBridge);
    this.cancelPolling();
    const refreshGeneration = this.generation;
    const status = await nextBridge.getDaemonStatus();
    this.commitRefresh(nextBridge, refreshGeneration, status);
    return status;
  }

  replaceStatus(status: DesktopDaemonStatus): void {
    this.snapshot = status;
    this.notify();
  }

  startBaselinePolling(nextBridge: ConduitDesktopBridge): void {
    this.adoptBridge(nextBridge);
    if (this.mode === null) {
      this.startLoop(nextBridge, "baseline", true);
    }
  }

  startPresencePolling(nextBridge: ConduitDesktopBridge): void {
    this.startLoop(nextBridge, "presence", false);
  }

  subscribe(
    nextBridge: ConduitDesktopBridge | null,
    listener: DesktopPairingStatusListener,
  ): () => void {
    this.listeners.add(listener);
    if (nextBridge !== null) {
      this.startBaselinePolling(nextBridge);
    }
    return () => {
      this.unsubscribe(listener);
    };
  }

  private adoptBridge(nextBridge: ConduitDesktopBridge): void {
    if (this.bridge === nextBridge) {
      return;
    }
    this.cancelPolling();
    this.snapshot = null;
    this.bridge = nextBridge;
    this.notify();
  }

  private canCommit(context: PollContext): boolean {
    return (
      this.generation === context.generation &&
      this.bridge === context.bridge &&
      this.listeners.size > 0
    );
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private clearSnapshot(): void {
    if (this.snapshot !== null) {
      this.snapshot = null;
      this.notify();
    }
  }

  private commitRefresh(
    nextBridge: ConduitDesktopBridge,
    refreshGeneration: number,
    status: DesktopDaemonStatus,
  ): void {
    const context = createPollContext(
      nextBridge,
      "baseline",
      refreshGeneration,
    );
    if (this.canCommit(context)) {
      this.replaceStatus(status);
      this.startLoop(nextBridge, "baseline", false);
    }
  }

  private async poll(context: PollContext): Promise<void> {
    const active = await this.readStatus(context);
    if (!active) {
      return;
    }
    if (this.shouldSwitchToBaseline(context)) {
      this.startLoop(context.bridge, "baseline", false);
      return;
    }
    this.scheduleNextPoll(context);
  }

  private readonly readStatus = async (
    context: PollContext,
  ): Promise<boolean> => {
    try {
      const nextStatus = await context.bridge.getDaemonStatus();
      if (!this.canCommit(context)) {
        return false;
      }
      this.replaceStatus(nextStatus);
      return true;
    } catch {
      if (!this.canCommit(context)) {
        return false;
      }
      this.clearSnapshot();
      return true;
    }
  };

  private scheduleNextPoll(context: PollContext): void {
    if (presenceDeadlineReached(context)) {
      this.startLoop(context.bridge, "baseline", false);
      return;
    }
    this.timer = setTimeout(() => {
      void this.poll(context);
    }, pollIntervalMs(context.mode));
  }

  private shouldSwitchToBaseline(context: PollContext): boolean {
    return (
      context.mode === "presence" &&
      this.snapshot !== null &&
      hasConnectedPresenceClient(this.snapshot)
    );
  }

  private startLoop(
    nextBridge: ConduitDesktopBridge,
    nextMode: PollMode,
    immediate: boolean,
  ): void {
    this.adoptBridge(nextBridge);
    this.clearTimer();
    this.generation += 1;
    this.mode = nextMode;
    this.startLoopTimer(
      createPollContext(nextBridge, nextMode, this.generation),
      immediate,
    );
  }

  private startLoopTimer(context: PollContext, immediate: boolean): void {
    if (immediate) {
      void this.poll(context);
      return;
    }
    this.timer = setTimeout(() => {
      void this.poll(context);
    }, pollIntervalMs(context.mode));
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private unsubscribe(listener: DesktopPairingStatusListener): void {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) {
      this.cancelPolling();
    }
  }
}

function createDesktopPairingStatusController(): DesktopPairingStatusController {
  return new DesktopPairingStatusControllerImpl();
}

const desktopPairingStatusController = createDesktopPairingStatusController();

export {
  baselinePollIntervalMs,
  createDesktopPairingStatusController,
  desktopPairingStatusController,
  presencePollDeadlineMs,
  presencePollIntervalMs,
};
export type { DesktopPairingStatusController };
