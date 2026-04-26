import { useSelector } from "react-redux";
import { selectSessionPromptTurnStreaming } from "@/app-state";
import type { ActiveSession, RootState } from "@/app-state";
import { Row, Spinner } from "@/ui";
import { sessionRowDepth } from "./session-list.constants";
import { openSessionTarget } from "./session-list-target";
import type { SessionGroup, SessionRow } from "./session-list.types";
import type { SessionListTargetSelected } from "./session-list-target";
import type { ReactNode } from "react";

function formatSessionMeta(provider: string, updatedAt: string | null): string {
  if (updatedAt === null) {
    return provider;
  }

  return `${provider} · ${updatedAt.slice(0, 10)}`;
}

function sessionTitle(title: string | null): string {
  if (title === null) {
    return "Untitled session";
  }

  return title;
}

function isActiveSession(
  session: {
    cwd: string;
    provider: string;
    sessionId: string;
  },
  activeSession: ActiveSession | null,
): boolean {
  return (
    activeSession !== null &&
    activeSession.kind === "open" &&
    activeSession.cwd === session.cwd &&
    activeSession.provider === session.provider &&
    activeSession.sessionId === session.sessionId
  );
}

function sessionRowLeading(isWorking: boolean): ReactNode | undefined {
  if (isWorking) {
    return <Spinner />;
  }
  return undefined;
}

interface SessionRowItemProps {
  group: SessionGroup;
  onSessionTargetSelected: SessionListTargetSelected;
  session: SessionRow;
  activeSession: ActiveSession | null;
}

function SessionRowItem({
  group,
  onSessionTargetSelected,
  session,
  activeSession,
}: SessionRowItemProps): React.JSX.Element {
  const isWorking = useSelector((state: RootState) =>
    selectSessionPromptTurnStreaming(state, {
      provider: session.provider,
      sessionId: session.sessionId,
    }),
  );

  return (
    <Row
      depth={sessionRowDepth}
      label={sessionTitle(session.title)}
      leading={sessionRowLeading(isWorking)}
      meta={formatSessionMeta(session.provider, session.updatedAt)}
      reserveLeadingSpace
      onPress={() => {
        onSessionTargetSelected(openSessionTarget(group, session));
      }}
      selected={isActiveSession(
        {
          cwd: group.cwd,
          provider: session.provider,
          sessionId: session.sessionId,
        },
        activeSession,
      )}
    />
  );
}

export { SessionRowItem };
