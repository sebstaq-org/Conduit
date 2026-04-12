import { Fragment } from "react";
import {
  openSessionRow,
  useGetSessionGroupsQuery,
  useOpenSessionMutation,
} from "@/app-state";
import { List, Row } from "@/ui";

const sessionRowDepth = 1;
const defaultUpdatedWithinDays = 5;

interface SessionListRowsProps {
  onSessionSelected?: (() => void) | undefined;
}

function sessionGroupsErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  return "session request failed";
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
  const { data, error, isError, isLoading } = useGetSessionGroupsQuery({
    updatedWithinDays: defaultUpdatedWithinDays,
  });
  const [openSession, openSessionState] = useOpenSessionMutation();
  const showOpenSessionError =
    openSessionState.isError && !openSessionState.isSuccess;

  return (
    <List>
      {isLoading && <Row label="Loading sessions" muted />}
      {isError && renderSessionsUnavailable(error)}
      {showOpenSessionError && <Row label="Session failed to open" muted />}
      {!isLoading && !isError && data?.groups.length === 0 && (
        <Row label="No sessions" muted />
      )}
      {!isLoading &&
        !isError &&
        data?.groups.map((group) => (
          <Fragment key={group.groupId}>
            <Row icon="folder" label={group.cwd} />
            {group.sessions.map((session) => (
              <Row
                key={`${session.provider}:${session.sessionId}`}
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
            ))}
          </Fragment>
        ))}
    </List>
  );
}

export { SessionListRows };
