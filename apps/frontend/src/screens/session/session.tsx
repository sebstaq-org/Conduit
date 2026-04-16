import {
  SessionComposer,
  useSessionComposerPlanInteractionMock,
} from "@/features/session-composer";
import { SessionHistory } from "@/features/session-history";
import { Box } from "@/theme";
import { IconButton, KeyboardLift } from "@/ui";
import type { ViewStyle } from "react-native";
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

const sessionScreenStyle: ViewStyle = { minHeight: 0 };

function SessionScreen({
  onOpenNavigationPanel,
}: SessionScreenProps): React.JSX.Element {
  const planInteractionMock = useSessionComposerPlanInteractionMock();
  return (
    <KeyboardLift>
      <Box
        backgroundColor={sessionScreenBackgroundColor}
        flex={sessionScreenFlex}
        gap={sessionScreenGap}
        px={sessionScreenPaddingX}
        py={sessionScreenPaddingY}
        style={sessionScreenStyle}
      >
        {onOpenNavigationPanel !== undefined && (
          <IconButton
            accessibilityLabel={sessionScreenNavigationPanelAccessibilityLabel}
            icon={sessionScreenNavigationPanelIcon}
            onPress={onOpenNavigationPanel}
          />
        )}
        <SessionHistory mockHistory={planInteractionMock.history} />
        <SessionComposer planInteractionMock={planInteractionMock} />
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
