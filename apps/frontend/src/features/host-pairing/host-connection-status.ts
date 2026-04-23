import type { ConnectionStatusKind } from "@/ui";

interface HostConnectionQuery {
  readonly currentData?: unknown;
  readonly data?: unknown;
  readonly fulfilledTimeStamp?: number;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isSuccess: boolean;
}

interface HostConnectionStatus {
  readonly indicator: ConnectionStatusKind;
  readonly label: "Connected" | "Connecting" | "Not connected";
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

function hostConnectionStatus(
  query: HostConnectionQuery,
  nowMs: number = Date.now(),
): HostConnectionStatus {
  if (hasVerifiedSuccess(query) && !query.isError) {
    return {
      indicator: "connected",
      label: "Connected",
      reason: "Relay connected",
    };
  }

  if (query.isError && hasRecentSuccess(query, nowMs)) {
    return {
      indicator: "connected",
      label: "Connected",
      reason: "Last verified moments ago",
    };
  }

  if (query.isFetching && !hasVerifiedSuccess(query)) {
    return {
      indicator: "connecting",
      label: "Connecting",
      reason: "Relay connecting",
    };
  }

  if (query.isError) {
    return {
      indicator: "disconnected",
      label: "Not connected",
      reason: "Relay failed",
    };
  }

  return {
    indicator: "disconnected",
    label: "Not connected",
    reason: "Relay idle",
  };
}

export { hostConnectionStatus, recentSuccessGraceMs };
export type { HostConnectionQuery, HostConnectionStatus };
