import type { RuntimeEvent, TranscriptItem } from "@conduit/app-protocol";

interface SessionTimelineChanged {
  items?: TranscriptItem[];
  openSessionId: string;
  revision: number;
}

interface SessionsIndexChanged {
  revision: number;
}

function readSessionTimelineChanged(
  event: RuntimeEvent,
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
  if (Array.isArray(event.items)) {
    changed.items = event.items;
  }
  return changed;
}

function readSessionsIndexChanged(
  event: RuntimeEvent,
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
