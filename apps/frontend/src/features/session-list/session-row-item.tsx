import { openSessionRow } from "@/app-state";
import type { useOpenSessionMutation } from "@/app-state/api-hooks";
import type { ActiveSession } from "@/app-state/session-selection";
import { Row } from "@/ui";
import { sessionRowDepth } from "./session-list.constants";
import type { SessionGroup, SessionRow } from "./session-list.types";

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

interface SessionRowItemProps {
  group: SessionGroup;
  onSessionSelected?: (() => void) | undefined;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  session: SessionRow;
  activeSession: ActiveSession | null;
}

function SessionRowItem({
  group,
  onSessionSelected,
  openSession,
  session,
  activeSession,
}: SessionRowItemProps): React.JSX.Element {
  return (
    <Row
      depth={sessionRowDepth}
      label={sessionTitle(session.title ?? null)}
      meta={formatSessionMeta(session.provider, session.updatedAt ?? null)}
      onPress={() => {
        void openSessionRow({
          onSessionSelected,
          openSession,
          request: {
            cwd: group.cwd,
            limit: 100,
            provider: session.provider,
            sessionId: session.sessionId,
            title: session.title ?? null,
          },
        });
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
