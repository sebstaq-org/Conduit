import { Fragment } from "react";
import { useGetSessionGroupsQuery } from "@/app-state";
import { List, Row } from "@/ui";

const sessionRowDepth = 1;

const emptySessionGroupsQuery = {};

const pinnedSession = {
  id: "pinned-session",
  label: "Pinned session",
  meta: "5d",
} as const;

function handleMockSessionPress(): boolean {
  return false;
}

function formatSessionUpdatedAt(updatedAt: string | null): string | undefined {
  if (updatedAt === null) {
    return undefined;
  }

  return "3d";
}

function sessionTitle(title: string | null): string {
  if (title === null) {
    return "Untitled session";
  }

  return title;
}

function SessionListRows(): React.JSX.Element {
  const { data, isError, isLoading } = useGetSessionGroupsQuery(
    emptySessionGroupsQuery,
  );

  return (
    <List>
      <Row
        icon={{ family: "material-community", name: "pin-outline" }}
        key={pinnedSession.id}
        label={pinnedSession.label}
        meta={pinnedSession.meta}
        onPress={handleMockSessionPress}
      />
      {isLoading && <Row label="Loading sessions" muted />}
      {isError && <Row label="Sessions unavailable" muted />}
      {!isLoading && !isError && data?.groups.length === 0 && (
        <Row label="No sessions" muted />
      )}
      {!isLoading &&
        !isError &&
        data?.groups.map((group) => (
          <Fragment key={group.groupId}>
            <Row
              icon="folder"
              label={group.cwd}
              onPress={handleMockSessionPress}
            />
            {group.sessions.map((session) => (
              <Row
                key={`${session.provider}:${session.sessionId}`}
                depth={sessionRowDepth}
                label={sessionTitle(session.title)}
                meta={formatSessionUpdatedAt(session.updatedAt)}
                onPress={handleMockSessionPress}
              />
            ))}
          </Fragment>
        ))}
    </List>
  );
}

export { SessionListRows };
