import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

const appShellBackgroundColor = "background" as const;
const appShellDrawerAccessibilityLabel = "Close navigation panel";
const appShellDrawerPosition = "left" as const;
const appShellDrawerType = "front" as const;
const appShellFlex = 1;
const appShellFlexDirection = "row" as const;
const appShellSwipeEdgeWidth = 96;
const appShellSwipeEnabled = true;

function createAppShellDrawerStyle(
  theme: Theme,
  windowWidth: number,
): ViewStyle {
  return {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderSubtle,
    borderRightWidth: 1,
    maxWidth: theme.panel.maxWidth,
    width: Math.min(windowWidth, theme.panel.maxWidth),
  };
}

function createAppShellRootStyle(theme: Theme): ViewStyle {
  return {
    backgroundColor: theme.colors.background,
    flex: appShellFlex,
  };
}

function isWideAppShellLayout(theme: Theme, windowWidth: number): boolean {
  return windowWidth >= theme.breakpoints.web;
}

export {
  appShellBackgroundColor,
  appShellDrawerAccessibilityLabel,
  appShellDrawerPosition,
  appShellDrawerType,
  appShellFlex,
  appShellFlexDirection,
  appShellSwipeEdgeWidth,
  appShellSwipeEnabled,
  createAppShellDrawerStyle,
  createAppShellRootStyle,
  isWideAppShellLayout,
};
