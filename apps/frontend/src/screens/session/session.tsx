import { SessionComposer } from "@/features/session-composer";
import { SessionHistory } from "@/features/session-history";
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
        <SessionHistory />
        <SessionComposer />
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
