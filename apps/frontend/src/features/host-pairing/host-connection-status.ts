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

function hasVerifiedSuccess(query: HostConnectionQuery): boolean {
  return (
    query.isSuccess ||
    query.currentData !== undefined ||
    query.data !== undefined ||
    query.fulfilledTimeStamp !== undefined
  );
}

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
  const verified = hasVerifiedSuccess(query);

  if (query.activeHostPaired === false) {
    return {
      indicator: "idle",
      label: "Desktop",
      reason: "No desktop paired",
    };
  }

  if (verified && !query.isError) {
    return {
      indicator: "connected",
      label: "Desktop",
      reason: "Relay connected",
    };
  }

  if (query.isError) {
    return failedConnectionStatus(query, nowMs);
  }

  if (query.isFetching && !verified) {
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
