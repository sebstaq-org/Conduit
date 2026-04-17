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
  const changed: SessionTimelineChanged = {
    openSessionId: event.openSessionId,
    revision: event.revision,
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
  return {
    revision: event.revision,
  };
}

export { readSessionTimelineChanged, readSessionsIndexChanged };
export type { SessionTimelineChanged, SessionsIndexChanged };
