import { SessionComposer } from "@/features/session-composer";
import { Box } from "@/theme";
import { IconButton, KeyboardLift } from "@/ui";
import {
  sessionScreenBackgroundColor,
  sessionScreenFlex,
  sessionScreenGap,
  sessionScreenNavigationPanelAccessibilityLabel,
  sessionScreenNavigationPanelIcon,
  sessionScreenPaddingX,
  sessionScreenPaddingY,
} from "./session.styles";

interface SessionScreenProps {
  onOpenNavigationPanel?: (() => void) | undefined;
}

function SessionScreen({
  onOpenNavigationPanel,
}: SessionScreenProps): React.JSX.Element {
  return (
    <KeyboardLift>
      <Box
        backgroundColor={sessionScreenBackgroundColor}
        flex={sessionScreenFlex}
        gap={sessionScreenGap}
        px={sessionScreenPaddingX}
        py={sessionScreenPaddingY}
      >
        {onOpenNavigationPanel !== undefined && (
          <IconButton
            accessibilityLabel={sessionScreenNavigationPanelAccessibilityLabel}
            icon={sessionScreenNavigationPanelIcon}
            onPress={onOpenNavigationPanel}
          />
        )}
        <SessionComposer />
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
