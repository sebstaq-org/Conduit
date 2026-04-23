import { DraftSessionRow } from "@/features/session-list/draft-session-row";
import { SessionGroupHeader } from "@/features/session-list/session-group-header";
import { SessionRowItem } from "@/features/session-list/session-row-item";
import type { ActiveSession, useOpenSessionMutation } from "@/app-state";
import { Row } from "@/ui";
import { renderStaticNavigationPanelRow } from "./navigation-panel-static-row";
import type { NavigationPanelScrollRow } from "./navigation-panel-scroll-rows";

interface NavigationPanelScrollRowItemProps {
  activeSession: ActiveSession | null;
  onSessionSelected?: (() => void) | undefined;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  row: NavigationPanelScrollRow;
}

type SessionNavigationPanelRow = Extract<
  NavigationPanelScrollRow,
  | { kind: "draftSession" }
  | { kind: "groupEmpty" }
  | { kind: "groupHeader" }
  | { kind: "session" }
>;

interface SessionRowRenderProps {
  activeSession: ActiveSession | null;
  onSessionSelected?: (() => void) | undefined;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  row: SessionNavigationPanelRow;
}

function isSessionNavigationPanelRow(
  row: NavigationPanelScrollRow,
): row is SessionNavigationPanelRow {
  return (
    row.kind === "groupHeader" ||
    row.kind === "draftSession" ||
    row.kind === "groupEmpty" ||
    row.kind === "session"
  );
}

function renderSessionNavigationPanelRow({
  activeSession,
  onSessionSelected,
  openSession,
  row,
}: SessionRowRenderProps): React.JSX.Element {
  if (row.kind === "groupHeader") {
    return <SessionGroupHeader group={row.group} />;
  }
  if (row.kind === "groupEmpty") {
    return <Row label="No recent sessions" muted reserveLeadingSpace />;
  }
  if (row.kind === "draftSession") {
    return <DraftSessionRow activeSession={row.activeSession} />;
  }
  return (
    <SessionRowItem
      activeSession={activeSession}
      group={row.group}
      onSessionSelected={onSessionSelected}
      openSession={openSession}
      session={row.session}
    />
  );
}

function NavigationPanelScrollRowItem(
  props: NavigationPanelScrollRowItemProps,
): React.JSX.Element {
  const staticRow = renderStaticNavigationPanelRow(props.row);
  if (staticRow !== null) {
    return staticRow;
  }
  if (!isSessionNavigationPanelRow(props.row)) {
    return <Row label="Row unavailable" muted />;
  }
  return renderSessionNavigationPanelRow({
    activeSession: props.activeSession,
    onSessionSelected: props.onSessionSelected,
    openSession: props.openSession,
    row: props.row,
  });
}

export { NavigationPanelScrollRowItem };
