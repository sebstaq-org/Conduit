import type { SessionGroupsView } from "@conduit/session-client";
import type { ActiveSession } from "@/app-state";
import { draftSessionMatchesCwd } from "@/features/session-list/draft-session";

type SessionGroup = SessionGroupsView["groups"][number];
type SessionRow = SessionGroup["sessions"][number];

type NavigationPanelScrollRow =
  | { kind: "heading"; key: "heading" }
  | { kind: "hostPairing"; key: "host-pairing" }
  | { kind: "projectRows"; key: "project-rows" }
  | { kind: "projectsHeader"; key: "projects-header" }
  | {
      kind: "status";
      key: string;
      label: string;
      meta?: string;
    }
  | {
      group: SessionGroup;
      kind: "groupHeader";
      key: string;
    }
  | {
      group: SessionGroup;
      kind: "groupEmpty";
      key: string;
    }
  | {
      activeSession: Extract<ActiveSession, { kind: "draft" }>;
      group: SessionGroup;
      kind: "draftSession";
      key: string;
    }
  | {
      group: SessionGroup;
      kind: "session";
      key: string;
      session: SessionRow;
    };

interface SessionRowsInput {
  activeSession: ActiveSession | null;
  data: SessionGroupsView | undefined;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  showOpenSessionError: boolean;
}

function sessionGroupsErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  return "session request failed";
}

function draftSessionForGroup(
  activeSession: ActiveSession | null,
  group: SessionGroup,
): Extract<ActiveSession, { kind: "draft" }> | null {
  if (draftSessionMatchesCwd(activeSession, group.cwd)) {
    return activeSession;
  }
  return null;
}

function appendGroupHeaderRow(
  rows: NavigationPanelScrollRow[],
  group: SessionGroup,
): void {
  rows.push({
    group,
    kind: "groupHeader",
    key: `group:${group.groupId}`,
  });
}

function appendDraftSessionRow(
  rows: NavigationPanelScrollRow[],
  group: SessionGroup,
  draftSession: Extract<ActiveSession, { kind: "draft" }> | null,
): void {
  if (draftSession !== null) {
    rows.push({
      activeSession: draftSession,
      group,
      kind: "draftSession",
      key: `group:${group.groupId}:draft`,
    });
  }
}

function appendSessionRows(
  rows: NavigationPanelScrollRow[],
  group: SessionGroup,
): void {
  for (const session of group.sessions) {
    rows.push({
      group,
      kind: "session",
      key: `session:${group.groupId}:${session.provider}:${session.sessionId}`,
      session,
    });
  }
}

function appendGroupEmptyRow(
  rows: NavigationPanelScrollRow[],
  group: SessionGroup,
): void {
  rows.push({
    group,
    kind: "groupEmpty",
    key: `group:${group.groupId}:empty`,
  });
}

function appendSessionGroupRows(
  rows: NavigationPanelScrollRow[],
  group: SessionGroup,
  activeSession: ActiveSession | null,
): void {
  const draftSession = draftSessionForGroup(activeSession, group);
  appendGroupHeaderRow(rows, group);
  appendDraftSessionRow(rows, group, draftSession);
  if (group.sessions.length === 0 && draftSession === null) {
    appendGroupEmptyRow(rows, group);
    return;
  }
  appendSessionRows(rows, group);
}

function appendStatusRows(
  rows: NavigationPanelScrollRow[],
  { data, error, isError, isLoading, showOpenSessionError }: SessionRowsInput,
): void {
  if (isLoading) {
    rows.push({
      kind: "status",
      key: "status:loading",
      label: "Loading sessions",
    });
  }
  if (isError) {
    rows.push({
      kind: "status",
      key: "status:error",
      label: "Sessions unavailable",
      meta: sessionGroupsErrorMessage(error),
    });
  }
  if (showOpenSessionError) {
    rows.push({
      kind: "status",
      key: "status:open-error",
      label: "Session failed to open",
    });
  }
  if (!isLoading && !isError && data?.groups.length === 0) {
    rows.push({ kind: "status", key: "status:empty", label: "No sessions" });
  }
}

function createSessionRows(
  input: SessionRowsInput,
): NavigationPanelScrollRow[] {
  const rows: NavigationPanelScrollRow[] = [];
  appendStatusRows(rows, input);
  for (const group of input.data?.groups ?? []) {
    appendSessionGroupRows(rows, group, input.activeSession);
  }
  return rows;
}

function createNavigationPanelRows(
  sessionRows: NavigationPanelScrollRow[],
): NavigationPanelScrollRow[] {
  return [
    { kind: "heading", key: "heading" },
    { kind: "hostPairing", key: "host-pairing" },
    { kind: "projectRows", key: "project-rows" },
    { kind: "projectsHeader", key: "projects-header" },
    ...sessionRows,
  ];
}

function navigationPanelRowType(row: NavigationPanelScrollRow): string {
  return row.kind;
}

export { createNavigationPanelRows, createSessionRows, navigationPanelRowType };
export type { NavigationPanelScrollRow };
