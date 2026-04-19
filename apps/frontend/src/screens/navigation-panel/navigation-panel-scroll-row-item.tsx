import { useSelector } from "react-redux";
import { selectActiveSession } from "@/app-state";
import { SessionGroupHeader } from "@/features/session-list/session-group-header";
import { SessionRowItem } from "@/features/session-list/session-row-item";
import type { ActiveSession, useOpenSessionMutation } from "@/app-state";
import { Row } from "@/ui";
import { renderStaticNavigationPanelRow } from "./navigation-panel-static-row";
import type { NavigationPanelScrollRow } from "./navigation-panel-scroll-rows";

interface NavigationPanelScrollRowItemProps {
  onSessionSelected?: (() => void) | undefined;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  row: NavigationPanelScrollRow;
}

const sessionRowDepth = 1;

type SessionNavigationPanelRow = Extract<
  NavigationPanelScrollRow,
  { kind: "groupEmpty" } | { kind: "groupHeader" } | { kind: "session" }
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
    return <Row depth={sessionRowDepth} label="No recent sessions" muted />;
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
  const activeSession = useSelector(selectActiveSession);
  const staticRow = renderStaticNavigationPanelRow(props.row);
  if (staticRow !== null) {
    return staticRow;
  }
  if (!isSessionNavigationPanelRow(props.row)) {
    return <Row label="Row unavailable" muted />;
  }
  return renderSessionNavigationPanelRow({
    activeSession,
    onSessionSelected: props.onSessionSelected,
    openSession: props.openSession,
    row: props.row,
  });
}

export { NavigationPanelScrollRowItem };
