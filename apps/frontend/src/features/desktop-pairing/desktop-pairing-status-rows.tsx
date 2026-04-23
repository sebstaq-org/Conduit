import { ConnectionStatusIndicator, Row } from "@/ui";
import type { DesktopDaemonStatus } from "@/app-state/desktop-bridge";
import type { ConnectionStatusKind } from "@/ui";

interface DesktopConnectionStatus {
  readonly indicator: ConnectionStatusKind;
  readonly label: "Connected" | "Connecting" | "Not connected";
  readonly reason: string;
}

function desktopConnectionStatus(
  status: DesktopDaemonStatus | null,
): DesktopConnectionStatus {
  if (status === null) {
    return {
      indicator: "connecting",
      label: "Connecting",
      reason: "Status not loaded",
    };
  }
  if (!status.running) {
    return {
      indicator: "disconnected",
      label: "Not connected",
      reason: "Daemon stopped",
    };
  }
  if (!status.backendHealthy) {
    return {
      indicator: "connecting",
      label: "Connecting",
      reason: "Daemon starting",
    };
  }
  if (!status.relayConfigured) {
    return {
      indicator: "disconnected",
      label: "Not connected",
      reason: "Relay not configured",
    };
  }
  return {
    indicator: "connected",
    label: "Connected",
    reason: "Daemon ready",
  };
}

function statusMeta(status: DesktopDaemonStatus | null): string | undefined {
  if (status === null) {
    return undefined;
  }
  return status.daemon?.serverId ?? `pid ${String(status.pid ?? "unknown")}`;
}

function DesktopPairingStatusRows({
  status,
}: {
  readonly status: DesktopDaemonStatus | null;
}): React.JSX.Element {
  const connection = desktopConnectionStatus(status);
  return (
    <>
      <Row
        label={connection.label}
        leading={
          <ConnectionStatusIndicator
            label={`${connection.label} indicator`}
            status={connection.indicator}
          />
        }
        meta={statusMeta(status)}
      />
      <Row label={connection.reason} muted />
      {status?.relayEndpoint !== undefined && status.relayEndpoint !== null && (
        <Row label="Relay configured" meta={status.relayEndpoint} muted />
      )}
      {status?.lastExit !== null && status?.lastExit !== undefined && (
        <Row label="Last daemon exit" meta={status.lastExit} muted />
      )}
    </>
  );
}

export { DesktopPairingStatusRows };
