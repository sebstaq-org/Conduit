import { MenuIconTrigger, MenuPortal, MenuRoot } from "@/ui";
import { ProjectActionsMenuContent } from "./project-actions-menu-content";

interface ProjectActionsMenuProps {
  displayName: string;
  projectId: string;
}

function ProjectActionsMenu({
  displayName,
  projectId,
}: ProjectActionsMenuProps): React.JSX.Element {
  return (
    <MenuRoot>
      <MenuIconTrigger
        accessibilityLabel={`Project actions for ${displayName}`}
        icon="more-horizontal"
      />
      <MenuPortal>
        <ProjectActionsMenuContent
          displayName={displayName}
          projectId={projectId}
        />
      </MenuPortal>
    </MenuRoot>
  );
}

export { ProjectActionsMenu };
