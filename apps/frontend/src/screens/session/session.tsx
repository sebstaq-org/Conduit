import { usePlanInteractionSource } from "@/app-state";
import { SessionComposer } from "@/features/session-composer";
import { SessionHistory } from "@/features/session-history";
import { Box } from "@/theme";
import { KeyboardLift } from "@/ui";
import type { ViewStyle } from "react-native";
import {
  sessionScreenBackgroundColor,
  sessionScreenFlex,
  sessionScreenGap,
  sessionScreenPaddingX,
  sessionScreenPaddingY,
} from "./session.styles";
import { SessionScreenTopBar } from "./session-top-bar";

interface SessionScreenProps {
  onOpenNavigationPanel?: (() => void) | undefined;
}

const sessionScreenStyle: ViewStyle = { minHeight: 0 };

function SessionScreen({
  onOpenNavigationPanel,
}: SessionScreenProps): React.JSX.Element {
  const planInteraction = usePlanInteractionSource();
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
          <SessionScreenTopBar onOpenNavigationPanel={onOpenNavigationPanel} />
        )}
        <SessionHistory />
        <SessionComposer planInteraction={planInteraction} />
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
