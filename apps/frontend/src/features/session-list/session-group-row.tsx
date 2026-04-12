import type { useOpenSessionMutation } from "@/app-state";
import { Row } from "@/ui";
import { SessionGroupHeader } from "./session-group-header";
import { sessionRowDepth } from "./session-list.constants";
import { SessionRowItem } from "./session-row-item";
import type { SessionGroup } from "./session-list.types";

interface SessionGroupRowProps {
  group: SessionGroup;
  onSessionSelected?: (() => void) | undefined;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
}

function SessionGroupRow({
  group,
  onSessionSelected,
  openSession,
}: SessionGroupRowProps): React.JSX.Element {
  return (
    <>
      <SessionGroupHeader group={group} />
      {group.sessions.length === 0 && (
        <Row depth={sessionRowDepth} label="No recent sessions" muted />
      )}
      {group.sessions.map((session) => (
        <SessionRowItem
          key={`${session.provider}:${session.sessionId}`}
          group={group}
          onSessionSelected={onSessionSelected}
          openSession={openSession}
          session={session}
        />
      ))}
    </>
  );
}

export { SessionGroupRow };
