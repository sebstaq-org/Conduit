import type { SessionGroupsView } from "@/app-state/models";

type SessionGroup = SessionGroupsView["groups"][number];
type SessionRow = SessionGroup["sessions"][number];

export type { SessionGroup, SessionRow };
