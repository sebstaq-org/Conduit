import type {
  useAddProjectMutation,
  useRemoveProjectMutation,
  useUpdateProjectMutation,
} from "./api";

type AddProjectTrigger = ReturnType<typeof useAddProjectMutation>[0];
type RemoveProjectTrigger = ReturnType<typeof useRemoveProjectMutation>[0];
type UpdateProjectTrigger = ReturnType<typeof useUpdateProjectMutation>[0];

interface ProjectMutationState {
  error?: unknown;
  isError: boolean;
  isLoading: boolean;
}

interface AddProjectPathArgs {
  addProject: AddProjectTrigger;
  close: () => void;
  cwd: string;
  disabled: boolean;
  setQuery: (query: string) => void;
}

async function addProjectPath({
  addProject,
  close,
  cwd,
  disabled,
  setQuery,
}: AddProjectPathArgs): Promise<void> {
  const trimmedCwd = cwd.trim();

  if (trimmedCwd.length === 0 || disabled) {
    return;
  }

  try {
    await addProject({ cwd: trimmedCwd }).unwrap();
    setQuery("");
    close();
  } catch {
    // The mutation state renders the failure while preserving the query.
  }
}

interface RemoveProjectByIdArgs {
  close: () => void;
  disabled: boolean;
  projectId: string;
  removeProject: RemoveProjectTrigger;
}

async function removeProjectById({
  close,
  disabled,
  projectId,
  removeProject,
}: RemoveProjectByIdArgs): Promise<void> {
  if (disabled) {
    return;
  }

  try {
    await removeProject({ projectId }).unwrap();
    close();
  } catch {
    // The mutation state renders the failure while the menu stays open.
  }
}

interface UpdateProjectDisplayNameArgs {
  close: () => void;
  disabled: boolean;
  displayName: string;
  projectId: string;
  updateProject: UpdateProjectTrigger;
}

async function updateProjectDisplayName({
  close,
  disabled,
  displayName,
  projectId,
  updateProject,
}: UpdateProjectDisplayNameArgs): Promise<void> {
  const trimmedDisplayName = displayName.trim();

  if (disabled || trimmedDisplayName.length === 0) {
    return;
  }

  try {
    await updateProject({
      displayName: trimmedDisplayName,
      projectId,
    }).unwrap();
    close();
  } catch {
    // The mutation state renders the failure while the edit form stays open.
  }
}

export { addProjectPath, removeProjectById, updateProjectDisplayName };
export type {
  ProjectMutationState,
  RemoveProjectTrigger,
  UpdateProjectTrigger,
};
