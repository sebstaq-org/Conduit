import { useTheme } from "@shopify/restyle";
import { usePlanInteractionSource } from "@/app-state";
import { SessionComposer } from "@/features/session-composer";
import { SessionHistory } from "@/features/session-history";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { KeyboardDock, KeyboardLift } from "@/ui";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createSessionComposerDockStyle,
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

function renderSessionViewport(
  onOpenNavigationPanel: SessionScreenProps["onOpenNavigationPanel"],
): React.JSX.Element {
  return (
    <Box
      flex={sessionScreenFlex}
      gap={sessionScreenGap}
      px={sessionScreenPaddingX}
      pt={sessionScreenPaddingY}
      style={sessionScreenStyle}
    >
      {onOpenNavigationPanel !== undefined && (
        <SessionScreenTopBar onOpenNavigationPanel={onOpenNavigationPanel} />
      )}
      <SessionHistory />
    </Box>
  );
}

function renderSessionComposerDock(args: {
  bottomInset: number;
  planInteraction: ReturnType<typeof usePlanInteractionSource>;
  theme: Theme;
}): React.JSX.Element {
  return (
    <KeyboardDock
      contentStyle={createSessionComposerDockStyle(
        args.theme,
        args.bottomInset,
      )}
    >
      <SessionComposer planInteraction={args.planInteraction} />
    </KeyboardDock>
  );
}

function SessionScreen({
  onOpenNavigationPanel,
}: SessionScreenProps): React.JSX.Element {
  const planInteraction = usePlanInteractionSource();
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme<Theme>();
  return (
    <KeyboardLift>
      <Box
        backgroundColor={sessionScreenBackgroundColor}
        flex={sessionScreenFlex}
        style={sessionScreenStyle}
      >
        {renderSessionViewport(onOpenNavigationPanel)}
        {renderSessionComposerDock({
          bottomInset: safeAreaInsets.bottom,
          planInteraction,
          theme,
        })}
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
