import { Fragment } from "react";
import type { ReactElement } from "react";
import { List, Row } from "@/ui";
import { sessionListViewModel } from "./session-list-view-model";
import type {
  SessionListGroup,
  SessionListSession,
} from "./session-list-view-model";

const sessionRowDepth = 1;

const pinnedSession = {
  id: "pinned-session",
  label: "Pinned session",
  meta: "5d",
} as const;

const emptyGroupId = "cwd:/workspace/validAIte";
const emptyGroupLabel = "No chats";

function handleMockSessionPress(): boolean {
  return false;
}

function formatSessionUpdatedAt(updatedAt: string | null): string | undefined {
  if (updatedAt === null) {
    return undefined;
  }

  return "3d";
}

function sessionTitle(session: SessionListSession): string {
  if (session.title === null) {
    return "Untitled session";
  }

  return session.title;
}

function emptyLabelForGroup(group: SessionListGroup): string | undefined {
  if (group.groupId !== emptyGroupId) {
    return undefined;
  }

  return emptyGroupLabel;
}

function renderGroup(group: SessionListGroup): ReactElement {
  const emptyLabel = emptyLabelForGroup(group);

  return (
    <Fragment key={group.groupId}>
      <Row icon="folder" label={group.label} onPress={handleMockSessionPress} />
      {group.sessions.map((session) => (
        <Row
          key={session.sessionId}
          depth={sessionRowDepth}
          label={sessionTitle(session)}
          meta={formatSessionUpdatedAt(session.updatedAt)}
          onPress={handleMockSessionPress}
        />
      ))}
      {emptyLabel !== undefined && (
        <Row depth={sessionRowDepth} label={emptyLabel} muted />
      )}
    </Fragment>
  );
}

function SessionListRows(): React.JSX.Element {
  return (
    <List>
      <Row
        icon={{ family: "material-community", name: "pin-outline" }}
        key={pinnedSession.id}
        label={pinnedSession.label}
        meta={pinnedSession.meta}
        onPress={handleMockSessionPress}
      />
      {sessionListViewModel.groups.map(
        (group): ReactElement => renderGroup(group),
      )}
    </List>
  );
}

export { SessionListRows };
