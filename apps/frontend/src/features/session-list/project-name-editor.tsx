import { updateProjectDisplayName } from "@/app-state";
import type {
  ProjectMutationState,
  UpdateProjectTrigger,
} from "@/app-state/project-commands";
import type { ProjectActionsMenuMode } from "./project-actions-menu-content";
import { ProjectNameEditorForm } from "./project-name-editor-form";

interface ProjectNameEditorProps {
  close: () => void;
  displayName: string;
  draftName: string;
  projectId: string;
  setDraftName: (draftName: string) => void;
  setMenuMode: (mode: ProjectActionsMenuMode) => void;
  updateProject: UpdateProjectTrigger;
  updateProjectState: ProjectMutationState;
}

function canSaveProjectName({
  displayName,
  draftName,
  saving,
}: {
  displayName: string;
  draftName: string;
  saving: boolean;
}): boolean {
  const trimmedDraftName = draftName.trim();
  return (
    !saving &&
    trimmedDraftName.length > 0 &&
    trimmedDraftName !== displayName.trim()
  );
}

function ProjectNameEditor({
  close,
  displayName,
  draftName,
  projectId,
  setDraftName,
  setMenuMode,
  updateProject,
  updateProjectState,
}: ProjectNameEditorProps): React.JSX.Element {
  const saving = updateProjectState.isLoading;
  const saveEnabled = canSaveProjectName({ displayName, draftName, saving });

  function handleSave(): void {
    void updateProjectDisplayName({
      close,
      disabled: !saveEnabled,
      displayName: draftName.trim(),
      projectId,
      updateProject,
    });
  }

  function handleCancel(): void {
    setMenuMode("menu");
  }

  return (
    <ProjectNameEditorForm
      draftName={draftName}
      error={updateProjectState.error}
      handleCancel={handleCancel}
      handleSave={handleSave}
      saveEnabled={saveEnabled}
      saving={saving}
      setDraftName={setDraftName}
      showError={updateProjectState.isError}
    />
  );
}

export { ProjectNameEditor };
