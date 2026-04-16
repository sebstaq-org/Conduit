import type { SessionGroupsView } from "@/app-state/models";

type SessionGroup = SessionGroupsView["groups"][number];
type SessionRow = SessionGroup["sessions"][number];

type NavigationPanelScrollRow =
  | { kind: "heading"; key: "heading" }
  | { kind: "projectRows"; key: "project-rows" }
  | { kind: "threadsHeader"; key: "threads-header" }
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
      group: SessionGroup;
      kind: "session";
      key: string;
      session: SessionRow;
    };

interface SessionRowsInput {
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

function appendSessionGroupRows(
  rows: NavigationPanelScrollRow[],
  group: SessionGroup,
): void {
  rows.push({
    group,
    kind: "groupHeader",
    key: `group:${group.groupId}`,
  });

  if (group.sessions.length === 0) {
    rows.push({
      group,
      kind: "groupEmpty",
      key: `group:${group.groupId}:empty`,
    });
    return;
  }

  for (const session of group.sessions) {
    rows.push({
      group,
      kind: "session",
      key: `session:${group.groupId}:${session.provider}:${session.sessionId}`,
      session,
    });
  }
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
    appendSessionGroupRows(rows, group);
  }
  return rows;
}

function createNavigationPanelRows(
  sessionRows: NavigationPanelScrollRow[],
): NavigationPanelScrollRow[] {
  return [
    { kind: "heading", key: "heading" },
    { kind: "projectRows", key: "project-rows" },
    { kind: "threadsHeader", key: "threads-header" },
    ...sessionRows,
  ];
}

function navigationPanelRowType(row: NavigationPanelScrollRow): string {
  return row.kind;
}

export { createNavigationPanelRows, createSessionRows, navigationPanelRowType };
export type { NavigationPanelScrollRow };
