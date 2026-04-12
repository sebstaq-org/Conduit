import type { useAddProjectMutation } from "./api";

type AddProjectTrigger = ReturnType<typeof useAddProjectMutation>[0];

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

export { addProjectPath };
