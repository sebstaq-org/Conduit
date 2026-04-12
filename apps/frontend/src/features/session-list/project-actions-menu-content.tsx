import { useState } from "react";
import {
  useRemoveProjectMutation,
  useUpdateProjectMutation,
} from "@/app-state";
import { usePopoverControls } from "@/ui/popover";
import { ProjectActionsMenuItems } from "./project-actions-menu-items";
import { ProjectNameEditor } from "./project-name-editor";

interface ProjectActionsMenuContentProps {
  displayName: string;
  projectId: string;
}

type ProjectActionsMenuMode = "edit" | "menu";

function ProjectActionsMenuContent({
  displayName,
  projectId,
}: ProjectActionsMenuContentProps): React.JSX.Element {
  const { close } = usePopoverControls();
  const [mode, setMode] = useState<ProjectActionsMenuMode>("menu");
  const [draftName, setDraftName] = useState(displayName);
  const [removeProject, removeProjectState] = useRemoveProjectMutation();
  const [updateProject, updateProjectState] = useUpdateProjectMutation();

  if (mode === "edit") {
    return (
      <ProjectNameEditor
        close={close}
        displayName={displayName}
        draftName={draftName}
        projectId={projectId}
        setDraftName={setDraftName}
        setMenuMode={setMode}
        updateProject={updateProject}
        updateProjectState={updateProjectState}
      />
    );
  }

  return (
    <ProjectActionsMenuItems
      close={close}
      displayName={displayName}
      projectId={projectId}
      removeProject={removeProject}
      removeProjectState={removeProjectState}
      setDraftName={setDraftName}
      setMenuMode={setMode}
    />
  );
}

export { ProjectActionsMenuContent };
export type { ProjectActionsMenuMode };
