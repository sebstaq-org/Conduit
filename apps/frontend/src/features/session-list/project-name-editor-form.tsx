import { Box, Text } from "@/theme";
import { MenuItem, TextField } from "@/ui";
import { projectActionErrorMessage } from "./project-action-error";

interface ProjectNameEditorFormProps {
  draftName: string;
  error: unknown;
  handleCancel: () => void;
  handleSave: () => void;
  saveEnabled: boolean;
  saving: boolean;
  setDraftName: (draftName: string) => void;
  showError: boolean;
}

function saveProjectLabel(saving: boolean): string {
  if (saving) {
    return "Saving";
  }

  return "Save";
}

function ProjectNameEditorForm({
  draftName,
  error,
  handleCancel,
  handleSave,
  saveEnabled,
  saving,
  setDraftName,
  showError,
}: ProjectNameEditorFormProps): React.JSX.Element {
  return (
    <Box gap="xs">
      <TextField
        accessibilityLabel="Project display name"
        disabled={saving}
        onChangeText={setDraftName}
        onSubmit={handleSave}
        placeholder="Display name"
        value={draftName}
      />
      {showError && (
        <Text variant="meta">{projectActionErrorMessage(error)}</Text>
      )}
      <MenuItem
        disabled={!saveEnabled}
        label={saveProjectLabel(saving)}
        onSelect={handleSave}
      />
      <MenuItem
        disabled={saving}
        label="Cancel"
        onSelect={handleCancel}
      />
    </Box>
  );
}

export { ProjectNameEditorForm };
