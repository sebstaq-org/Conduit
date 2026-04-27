import { DraftSessionRow } from "@/features/session-list/draft-session-row";
import { SessionGroupHeader } from "@/features/session-list/session-group-header";
import { SessionRowItem } from "@/features/session-list/session-row-item";
import type { ActiveSession } from "@/app-state";
import type { SessionListTargetSelected } from "@/features/session-list/session-list-target";
import { Row } from "@/ui";
import { renderStaticNavigationPanelRow } from "./navigation-panel-static-row";
import type { NavigationPanelScrollRow } from "./navigation-panel-scroll-rows";

interface NavigationPanelScrollRowItemProps {
  activeSession: ActiveSession | null;
  onSessionTargetSelected: SessionListTargetSelected;
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
  onSessionTargetSelected: SessionListTargetSelected;
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
  onSessionTargetSelected,
  row,
}: SessionRowRenderProps): React.JSX.Element {
  if (row.kind === "groupHeader") {
    return (
      <SessionGroupHeader
        group={row.group}
        onSessionTargetSelected={onSessionTargetSelected}
      />
    );
  }
  if (row.kind === "groupEmpty") {
    return <Row label="No recent sessions" muted reserveLeadingSpace />;
  }
  if (row.kind === "draftSession") {
    return (
      <DraftSessionRow
        activeSession={row.activeSession}
        onSessionTargetSelected={onSessionTargetSelected}
      />
    );
  }
  return (
    <SessionRowItem
      activeSession={activeSession}
      group={row.group}
      onSessionTargetSelected={onSessionTargetSelected}
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
    onSessionTargetSelected: props.onSessionTargetSelected,
    row: props.row,
  });
}

export { NavigationPanelScrollRowItem };
