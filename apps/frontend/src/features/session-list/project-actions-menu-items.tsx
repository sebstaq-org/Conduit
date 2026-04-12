import { removeProjectById } from "@/app-state";
import type { ProjectMutationState, RemoveProjectTrigger } from "@/app-state";
import { Box, Text } from "@/theme";
import { MenuItem } from "@/ui";
import { projectActionErrorMessage } from "./project-action-error";
import type { ProjectActionsMenuMode } from "./project-actions-menu-content";

interface ProjectActionsMenuItemsProps {
  close: () => void;
  displayName: string;
  projectId: string;
  removeProject: RemoveProjectTrigger;
  removeProjectState: ProjectMutationState;
  setDraftName: (draftName: string) => void;
  setMenuMode: (mode: ProjectActionsMenuMode) => void;
}

function removeProjectLabel(removing: boolean): string {
  if (removing) {
    return "Removing";
  }

  return "Remove";
}

function ProjectActionsMenuItems({
  close,
  displayName,
  projectId,
  removeProject,
  removeProjectState,
  setDraftName,
  setMenuMode,
}: ProjectActionsMenuItemsProps): React.JSX.Element {
  const removing = removeProjectState.isLoading;

  return (
    <Box gap="xxs">
      {removeProjectState.isError && (
        <Text variant="meta">
          {projectActionErrorMessage(removeProjectState.error)}
        </Text>
      )}
      <MenuItem
        label="Edit display name"
        onSelect={() => {
          setDraftName(displayName);
          setMenuMode("edit");
        }}
      />
      <MenuItem
        disabled={removing}
        label={removeProjectLabel(removing)}
        onSelect={() => {
          void removeProjectById({
            close,
            disabled: removing,
            projectId,
            removeProject,
          });
        }}
      />
    </Box>
  );
}

export { ProjectActionsMenuItems };
