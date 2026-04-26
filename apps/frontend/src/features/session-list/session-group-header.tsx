import { Box } from "@/theme";
import { IconButton, Row } from "@/ui";
import { ProjectActionsMenu } from "./project-actions-menu";
import { draftSessionTarget } from "./session-list-target";
import type { SessionGroup } from "./session-list.types";
import type { SessionListTargetSelected } from "./session-list-target";

interface SessionGroupHeaderProps {
  group: SessionGroup;
  onSessionTargetSelected: SessionListTargetSelected;
}

function projectPathMeta(group: SessionGroup): string | undefined {
  if (group.displayName === group.cwd) {
    return undefined;
  }
  return group.cwd;
}

function SessionGroupHeader({
  group,
  onSessionTargetSelected,
}: SessionGroupHeaderProps): React.JSX.Element {
  return (
    <Row
      icon="folder"
      label={group.displayName}
      meta={projectPathMeta(group)}
      trailing={
        <Box flexDirection="row" gap="xxs">
          <IconButton
            accessibilityLabel={`New session in ${group.cwd}`}
            icon="plus"
            onPress={() => {
              onSessionTargetSelected(draftSessionTarget(group.cwd));
            }}
          />
          <ProjectActionsMenu
            displayName={group.displayName}
            projectId={group.groupId}
          />
        </Box>
      }
    />
  );
}

export { SessionGroupHeader };
