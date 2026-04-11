import type { RuntimeEvent } from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";

interface SessionTimelineChanged {
  sequence: number;
  provider: ProviderId;
  openSessionId: string;
  revision: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSessionTimelineChanged(
  event: RuntimeEvent,
): SessionTimelineChanged | null {
  if (event.kind !== "session_timeline_changed" || !isRecord(event.payload)) {
    return null;
  }
  const openSessionId = event.payload.openSessionId;
  const revision = event.payload.revision;
  if (typeof openSessionId !== "string" || typeof revision !== "number") {
    return null;
  }
  return {
    sequence: event.sequence,
    provider: event.provider,
    openSessionId,
    revision,
  };
}

export { readSessionTimelineChanged };
export type { SessionTimelineChanged };
