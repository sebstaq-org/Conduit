import { openSessionRow } from "@/app-state";
import type { useOpenSessionMutation } from "@/app-state";
import { Row } from "@/ui";
import { sessionRowDepth } from "./session-list.constants";
import type { SessionGroup, SessionRow } from "./session-list.types";

interface SessionRowItemProps {
  group: SessionGroup;
  onSessionSelected?: (() => void) | undefined;
  openSession: ReturnType<typeof useOpenSessionMutation>[0];
  session: SessionRow;
}

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

function SessionRowItem({
  group,
  onSessionSelected,
  openSession,
  session,
}: SessionRowItemProps): React.JSX.Element {
  return (
    <Row
      depth={sessionRowDepth}
      label={sessionTitle(session.title)}
      meta={formatSessionMeta(session.provider, session.updatedAt)}
      onPress={() => {
        void openSessionRow({
          onSessionSelected,
          openSession,
          request: {
            cwd: group.cwd,
            provider: session.provider,
            sessionId: session.sessionId,
            title: session.title,
          },
        });
      }}
    />
  );
}

export { SessionRowItem };
