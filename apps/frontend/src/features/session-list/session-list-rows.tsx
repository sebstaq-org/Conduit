import { useSelector } from "react-redux";
import {
  selectActiveSession,
  useGetSessionGroupsQuery,
  useOpenSessionMutation,
} from "@/app-state";
import { List, Row } from "@/ui";
import { SessionGroupRow } from "./session-group-row";

const defaultSessionGroupsQuery = {};

interface SessionListRowsProps {
  onSessionSelected?: (() => void) | undefined;
}

function sessionGroupsErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  return "session request failed";
}

function renderSessionsUnavailable(error: unknown): React.JSX.Element {
  return (
    <Row
      label="Sessions unavailable"
      meta={sessionGroupsErrorMessage(error)}
      muted
    />
  );
}

function SessionListRows({
  onSessionSelected,
}: SessionListRowsProps): React.JSX.Element {
  const { data, error, isError, isLoading } = useGetSessionGroupsQuery(
    defaultSessionGroupsQuery,
  );
  const [openSession, openSessionState] = useOpenSessionMutation();
  const showOpenSessionError =
    openSessionState.isError && !openSessionState.isSuccess;
  const activeSession = useSelector(selectActiveSession);
  const shouldShowGroups = !isLoading && !isError && data?.groups.length !== 0;
  const visibleGroups = data?.groups ?? [];
  const hasVisibleGroups = visibleGroups.length > 0;

  return (
    <List>
      {isLoading && <Row label="Loading sessions" muted />}
      {isError && renderSessionsUnavailable(error)}
      {showOpenSessionError && <Row label="Session failed to open" muted />}
      {!isLoading && !isError && !hasVisibleGroups && (
        <Row label="No sessions" muted />
      )}
      {shouldShowGroups &&
        visibleGroups.map((group) => (
          <SessionGroupRow
            activeSession={activeSession}
            key={group.groupId}
            group={group}
            onSessionSelected={onSessionSelected}
            openSession={openSession}
          />
        ))}
    </List>
  );
}

export { SessionListRows };
