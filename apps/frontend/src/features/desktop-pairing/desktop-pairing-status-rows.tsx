import { Row } from "@/ui";
import type { DesktopDaemonStatus } from "@/app-state/desktop-bridge";

function statusLabel(status: DesktopDaemonStatus | null): string {
  if (status === null) {
    return "Status not loaded";
  }
  if (!status.running) {
    return "Daemon stopped";
  }
  if (!status.backendHealthy) {
    return "Daemon starting";
  }
  if (!status.relayConfigured) {
    return "Relay not configured";
  }
  return "Daemon ready";
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
  return (
    <>
      <Row label={statusLabel(status)} meta={statusMeta(status)} />
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
