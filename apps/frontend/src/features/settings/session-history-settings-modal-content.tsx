import { Box, Text } from "@/theme";
import { Row, TextField } from "@/ui";

interface SessionHistorySettingsModalContentProps {
  canSave: boolean;
  disabled: boolean;
  onChangeText: (value: string) => void;
  onSave: () => void;
  value: string;
}

function SessionHistorySettingsModalContent({
  canSave,
  disabled,
  onChangeText,
  onSave,
  value,
}: SessionHistorySettingsModalContentProps): React.JSX.Element {
  return (
    <Box gap="sm" minWidth={280}>
      <Text variant="panelHeading">Settings</Text>
      <Text variant="sectionTitle">Session history</Text>
      <TextField
        accessibilityLabel="Session history"
        disabled={disabled}
        onChangeText={onChangeText}
        onSubmit={onSave}
        placeholder="Days"
        value={value}
      />
      <Row icon="check" label="Save" muted={!canSave} onPress={onSave} />
    </Box>
  );
}

export { SessionHistorySettingsModalContent };
