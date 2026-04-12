import type { SessionGroupsView } from "@conduit/session-client";

type SessionGroup = SessionGroupsView["groups"][number];
type SessionRow = SessionGroup["sessions"][number];

export type { SessionGroup, SessionRow };
