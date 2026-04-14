import { PROVIDERS } from "@conduit/session-client";

import { useNewSessionMutation } from "@/app-state";
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
  const [newSession, newSessionState] = useNewSessionMutation();

  return (
    <Row
      icon="folder"
      label={group.displayName}
      meta={group.cwd}
      trailing={
        <Box flexDirection="row" gap="xxs">
          {PROVIDERS.map((provider) => (
            <IconButton
              accessibilityLabel={`New ${provider} session in ${group.cwd}`}
              disabled={newSessionState.isLoading}
              icon="plus"
              key={provider}
              onPress={() => {
                void newSession({ cwd: group.cwd, limit: 100, provider });
              }}
            />
          ))}
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
