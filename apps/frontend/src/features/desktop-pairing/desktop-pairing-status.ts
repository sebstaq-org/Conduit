import type { PendingAction } from "./desktop-pairing-state";
import type { ConnectionStatusKind } from "@/ui";

interface DesktopPairingStatusSnapshot {
  readonly backendHealthy: boolean;
  readonly mobilePeerConnected: boolean;
  readonly pairingConfigured: boolean;
  readonly relayConfigured: boolean;
  readonly running: boolean;
}

interface DesktopPairingPresentationRequest {
  readonly actionError: string | null;
  readonly offerReady: boolean;
  readonly pending: PendingAction;
  readonly status: DesktopPairingStatusSnapshot | null;
}

interface DesktopPairingPresentation {
  readonly indicator: ConnectionStatusKind;
  readonly recoveryVisible: boolean;
  readonly showMobilePairing: boolean;
}

function daemonNeedsRecovery(
  status: DesktopPairingStatusSnapshot | null,
): boolean {
  return (
    status !== null &&
    (!status.running ||
      !status.backendHealthy ||
      !status.relayConfigured ||
      !status.pairingConfigured)
  );
}

function desktopPairingPresentation({
  actionError,
  pending,
  status,
}: DesktopPairingPresentationRequest): DesktopPairingPresentation {
  if (pending !== null) {
    return {
      indicator: "connecting",
      recoveryVisible: false,
      showMobilePairing: true,
    };
  }
  if (actionError !== null) {
    return {
      indicator: "disconnected",
      recoveryVisible: true,
      showMobilePairing: true,
    };
  }
  if (daemonNeedsRecovery(status)) {
    return {
      indicator: "disconnected",
      recoveryVisible: true,
      showMobilePairing: false,
    };
  }
  if (status?.mobilePeerConnected === true) {
    return {
      indicator: "connected",
      recoveryVisible: false,
      showMobilePairing: true,
    };
  }
  return {
    indicator: "idle",
    recoveryVisible: false,
    showMobilePairing: true,
  };
}

export { desktopPairingPresentation };
export type {
  DesktopPairingPresentation,
  DesktopPairingPresentationRequest,
  DesktopPairingStatusSnapshot,
};
