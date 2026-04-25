import type { ConnectionStatusKind } from "@/ui";

interface HostConnectionQuery {
  readonly activeHostPaired?: boolean;
  readonly currentData?: unknown;
  readonly data?: unknown;
  readonly fulfilledTimeStamp?: number;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isSuccess: boolean;
}

interface HostConnectionStatus {
  readonly indicator: ConnectionStatusKind;
  readonly label: "Desktop";
  readonly reason: string;
}

const recentSuccessGraceMs = 15_000;

function hasRecentSuccess(query: HostConnectionQuery, nowMs: number): boolean {
  return (
    query.fulfilledTimeStamp !== undefined &&
    nowMs - query.fulfilledTimeStamp <= recentSuccessGraceMs
  );
}

function failedConnectionStatus(
  query: HostConnectionQuery,
  nowMs: number,
): HostConnectionStatus {
  if (hasRecentSuccess(query, nowMs)) {
    return {
      indicator: "connected",
      label: "Desktop",
      reason: "Last verified moments ago",
    };
  }
  return {
    indicator: "disconnected",
    label: "Desktop",
    reason: "Relay failed",
  };
}

function hostConnectionStatus(
  query: HostConnectionQuery,
  nowMs: number = Date.now(),
): HostConnectionStatus {
  const recentlyVerified = hasRecentSuccess(query, nowMs);

  if (query.activeHostPaired === false) {
    return {
      indicator: "idle",
      label: "Desktop",
      reason: "No desktop paired",
    };
  }

  if (recentlyVerified && !query.isError) {
    return {
      indicator: "connected",
      label: "Desktop",
      reason: "Relay connected",
    };
  }

  if (query.isError) {
    return failedConnectionStatus(query, nowMs);
  }

  if (query.isFetching) {
    return {
      indicator: "connecting",
      label: "Desktop",
      reason: "Relay connecting",
    };
  }

  return {
    indicator: "idle",
    label: "Desktop",
    reason: "Relay idle",
  };
}

export { hostConnectionStatus, recentSuccessGraceMs };
export type { HostConnectionQuery, HostConnectionStatus };
