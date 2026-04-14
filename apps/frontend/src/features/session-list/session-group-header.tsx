import { useDispatch } from "react-redux";

import { draftSessionStarted } from "@/app-state";
import { Box } from "@/theme";
import { IconButton, Row } from "@/ui";
import { ProjectActionsMenu } from "./project-actions-menu";
import type { SessionGroup } from "./session-list.types";

interface SessionGroupHeaderProps {
  group: SessionGroup;
}

function SessionGroupHeader({
  group,
}: SessionGroupHeaderProps): React.JSX.Element {
  const dispatch = useDispatch();

  return (
    <Row
      icon="folder"
      label={group.displayName}
      meta={group.cwd}
      trailing={
        <Box flexDirection="row" gap="xxs">
          <IconButton
            accessibilityLabel={`New session in ${group.cwd}`}
            icon="plus"
            onPress={() => {
              dispatch(draftSessionStarted({ cwd: group.cwd }));
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
