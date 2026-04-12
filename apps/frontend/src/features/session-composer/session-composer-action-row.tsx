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
  onSend: () => void;
  provider?: string | undefined;
}

function SessionComposerActionRow({
  canSend,
  onSend,
  provider,
}: SessionComposerActionRowProps): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      justifyContent={sessionComposerRowJustifyContent}
    >
      <SessionComposerControls provider={provider} />
      <IconButton
        accessibilityLabel={sessionComposerSendAccessibilityLabel}
        appearance="filled"
        disabled={!canSend}
        icon={sessionComposerSendIcon}
        onPress={onSend}
      />
    </Box>
  );
}

export { SessionComposerActionRow };
