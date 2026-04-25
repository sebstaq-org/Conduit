import type { PendingAction } from "./desktop-pairing-state";
import type { DesktopPresenceSnapshot } from "@/app-state/desktop-bridge";
import type { ConnectionStatusKind } from "@/ui";

interface DesktopPairingStatusSnapshot {
  readonly backendHealthy: boolean;
  readonly pairingConfigured: boolean;
  readonly presence: DesktopPresenceSnapshot | null;
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
  readonly connectedClientCount: number;
  readonly recoveryVisible: boolean;
  readonly showMobilePairing: boolean;
}

function connectedPresenceClients(
  presence: DesktopPresenceSnapshot | null,
): number {
  return presence?.clients.filter((client) => client.connected).length ?? 0;
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
      connectedClientCount: 0,
      indicator: "connecting",
      recoveryVisible: false,
      showMobilePairing: true,
    };
  }
  if (actionError !== null) {
    return {
      connectedClientCount: 0,
      indicator: "disconnected",
      recoveryVisible: true,
      showMobilePairing: true,
    };
  }
  if (daemonNeedsRecovery(status)) {
    return {
      connectedClientCount: 0,
      indicator: "disconnected",
      recoveryVisible: true,
      showMobilePairing: false,
    };
  }
  const connectedClientCount = connectedPresenceClients(
    status?.presence ?? null,
  );
  if (connectedClientCount > 0) {
    return {
      connectedClientCount,
      indicator: "connected",
      recoveryVisible: false,
      showMobilePairing: true,
    };
  }
  return {
    connectedClientCount: 0,
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
