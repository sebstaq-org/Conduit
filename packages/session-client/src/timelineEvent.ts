import type { RuntimeEvent } from "@conduit/session-contracts";
import type { ProviderId } from "@conduit/session-model";

interface SessionTimelineChanged {
  sequence: number;
  provider: ProviderId;
  openSessionId: string;
  revision: number;
}

interface SessionsIndexChanged {
  sequence: number;
  provider: ProviderId;
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

function readSessionsIndexChanged(
  event: RuntimeEvent,
): SessionsIndexChanged | null {
  if (event.kind !== "sessions_index_changed" || !isRecord(event.payload)) {
    return null;
  }
  const revision = event.payload.revision;
  if (typeof revision !== "number") {
    return null;
  }
  return {
    sequence: event.sequence,
    provider: event.provider,
    revision,
  };
}

export { readSessionTimelineChanged, readSessionsIndexChanged };
export type { SessionTimelineChanged, SessionsIndexChanged };
