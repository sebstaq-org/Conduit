import { SessionListRows } from "./session-list-rows";

interface SessionListProps {
  onSessionSelected?: (() => void) | undefined;
}

function SessionList({
  onSessionSelected,
}: SessionListProps): React.JSX.Element {
  return <SessionListRows onSessionSelected={onSessionSelected} />;
}

export { SessionList };
