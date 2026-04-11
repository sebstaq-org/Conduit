import { Box } from "@/theme";
import { IconButton } from "@/ui";
import { SessionComposerControls } from "./session-composer-controls";
import {
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
  sessionComposerRowJustifyContent,
  sessionComposerSendAccessibilityLabel,
  sessionComposerSendIcon,
} from "./session-composer.styles";

interface SessionComposerActionRowProps {
  canSend: boolean;
  onMockSend: () => void;
}

function SessionComposerActionRow({
  canSend,
  onMockSend,
}: SessionComposerActionRowProps): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      justifyContent={sessionComposerRowJustifyContent}
    >
      <SessionComposerControls />
      <IconButton
        accessibilityLabel={sessionComposerSendAccessibilityLabel}
        appearance="filled"
        disabled={!canSend}
        icon={sessionComposerSendIcon}
        onPress={onMockSend}
      />
    </Box>
  );
}

export { SessionComposerActionRow };
