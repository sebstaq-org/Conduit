import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

const sessionScreenBackgroundColor = "background" as const;
const sessionScreenFlex = 1;
const sessionScreenGap = "lg" as const;
const sessionScreenNavigationPanelAccessibilityLabel = "Open navigation panel";
const sessionScreenNavigationPanelIcon = "navigation-panel-toggle" as const;
const sessionScreenPaddingX = "contentX" as const;
const sessionScreenPaddingY = "contentTop" as const;
const sessionTopBarAlignItems = "center" as const;
const sessionTopBarFlexDirection = "row" as const;
const sessionTopBarJustifyContent = "space-between" as const;

function createSessionComposerDockStyle(theme: Theme): ViewStyle {
  return {
    paddingBottom: theme.spacing.contentTop,
    paddingHorizontal: theme.spacing.contentX,
    paddingTop: theme.spacing[sessionScreenGap],
  };
}

export {
  createSessionComposerDockStyle,
  sessionScreenBackgroundColor,
  sessionScreenFlex,
  sessionScreenGap,
  sessionScreenNavigationPanelAccessibilityLabel,
  sessionScreenNavigationPanelIcon,
  sessionScreenPaddingX,
  sessionScreenPaddingY,
  sessionTopBarAlignItems,
  sessionTopBarFlexDirection,
  sessionTopBarJustifyContent,
};
