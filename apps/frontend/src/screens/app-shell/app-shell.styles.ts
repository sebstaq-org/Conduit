import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

const appShellBackgroundColor = "background" as const;
const appShellDrawerAccessibilityLabel = "Close navigation panel";
const appShellDrawerPosition = "left" as const;
const appShellDrawerType = "front" as const;
const appShellFlex = 1;
const appShellFlexDirection = "row" as const;
const appShellPanelResizeHandleWidth = 10;
const appShellPanelResizeLineWidth = 1;
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
    maxWidth: theme.panel.drawerMaxWidth,
    width: Math.min(windowWidth, theme.panel.drawerMaxWidth),
  };
}

function createAppShellRootStyle(theme: Theme): ViewStyle {
  return {
    backgroundColor: theme.colors.background,
    flex: appShellFlex,
    minHeight: 0,
  };
}

function isWideAppShellLayout(theme: Theme, windowWidth: number): boolean {
  return windowWidth >= theme.breakpoints.web;
}

function clampNavigationPanelWidth(
  panelWidth: number,
  minWidth: number,
  maxWidth: number,
): number {
  return Math.min(Math.max(panelWidth, minWidth), maxWidth);
}

function navigationPanelMaxWidth(theme: Theme, windowWidth: number): number {
  const viewportMaxWidth = windowWidth - theme.appShell.minContentWidth;

  return Math.max(
    theme.panel.minWidth,
    Math.min(theme.panel.maxWidth, viewportMaxWidth),
  );
}

function createNavigationPanelResizeHandleStyle(theme: Theme): ViewStyle {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flexShrink: 0,
    justifyContent: "center",
    width: appShellPanelResizeHandleWidth,
  };
}

function createNavigationPanelResizeHandleLineStyle(theme: Theme): ViewStyle {
  return {
    backgroundColor: theme.colors.borderSubtle,
    height: "100%",
    width: appShellPanelResizeLineWidth,
  };
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
  clampNavigationPanelWidth,
  createAppShellDrawerStyle,
  createNavigationPanelResizeHandleLineStyle,
  createNavigationPanelResizeHandleStyle,
  createAppShellRootStyle,
  isWideAppShellLayout,
  navigationPanelMaxWidth,
};
