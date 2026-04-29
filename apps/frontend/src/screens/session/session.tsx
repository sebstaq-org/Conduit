import { useState } from "react";
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
import { SessionComposerDock } from "./session-composer-dock";
import { SessionScreenTopBar } from "./session-top-bar";

interface SessionScreenProps {
  onOpenNavigationPanel?: (() => void) | undefined;
}

const sessionScreenStyle: ViewStyle = { minHeight: 0 };

function renderSessionViewport(
  onOpenNavigationPanel: SessionScreenProps["onOpenNavigationPanel"],
  composerDockHeight: number,
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
      <SessionHistory composerDockHeight={composerDockHeight} />
    </Box>
  );
}

function SessionScreen({
  onOpenNavigationPanel,
}: SessionScreenProps): React.JSX.Element {
  const [composerDockHeight, setComposerDockHeight] = useState(0);
  return (
    <KeyboardLift>
      <Box
        backgroundColor={sessionScreenBackgroundColor}
        flex={sessionScreenFlex}
        style={sessionScreenStyle}
      >
        {renderSessionViewport(onOpenNavigationPanel, composerDockHeight)}
        <SessionComposerDock onHeightChange={setComposerDockHeight} />
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
