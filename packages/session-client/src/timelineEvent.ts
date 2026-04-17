import type { ConduitRuntimeEvent } from "@conduit/app-protocol";
import { TranscriptItemSchema } from "@conduit/session-model";
import type { TranscriptItem } from "@conduit/session-model";

interface SessionTimelineChanged {
  items?: TranscriptItem[];
  openSessionId: string;
  revision: number;
}

interface SessionsIndexChanged {
  revision: number;
}

function readSessionTimelineChanged(
  event: ConduitRuntimeEvent,
): SessionTimelineChanged | null {
  if (event.kind !== "session_timeline_changed") {
    return null;
  }
  const openSessionId = event.openSessionId;
  const revision = event.revision;
  if (typeof openSessionId !== "string" || typeof revision !== "number") {
    return null;
  }
  const changed: SessionTimelineChanged = {
    openSessionId,
    revision,
  };
  if (event.items) {
    changed.items = TranscriptItemSchema.array().parse(event.items);
  }
  return changed;
}

function readSessionsIndexChanged(
  event: ConduitRuntimeEvent,
): SessionsIndexChanged | null {
  if (event.kind !== "sessions_index_changed") {
    return null;
  }
  const revision = event.revision;
  if (typeof revision !== "number") {
    return null;
  }
  return {
    revision,
  };
}

export { readSessionTimelineChanged, readSessionsIndexChanged };
export type { SessionTimelineChanged, SessionsIndexChanged };
