import { Row } from "@/ui";
import { ProjectActionsMenu } from "./project-actions-menu";
import type { SessionGroup } from "./session-list.types";

interface SessionGroupHeaderProps {
  group: SessionGroup;
}

function SessionGroupHeader({
  group,
}: SessionGroupHeaderProps): React.JSX.Element {
  return (
    <Row
      icon="folder"
      label={group.displayName}
      meta={group.cwd}
      trailing={
        <ProjectActionsMenu
          displayName={group.displayName}
          projectId={group.groupId}
        />
      }
    />
  );
}

export { SessionGroupHeader };
