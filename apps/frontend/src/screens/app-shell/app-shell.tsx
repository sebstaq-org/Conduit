import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { useWindowDimensions } from "react-native";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import type { ViewStyle } from "react-native";
import { NavigationPanelContent } from "@/screens/navigation-panel/navigation-panel-content";
import { SessionScreen } from "@/screens/session";
import { PanelFrame } from "@/ui";
import { MobileAppShell } from "./mobile-app-shell";
import { NavigationPanelResizeHandle } from "./navigation-panel-resize-handle";
import {
  appShellBackgroundColor,
  appShellFlex,
  appShellFlexDirection,
  clampNavigationPanelWidth,
  isWideAppShellLayout,
  navigationPanelMaxWidth,
} from "./app-shell.styles";

interface RenderNavigationPanelOptions {
  onSessionSelected?: (() => void) | undefined;
  width?: number | undefined;
}

interface NavigationPanelWidthState {
  handleWidthChange: (width: number) => void;
  maxWidth: number;
  minWidth: number;
  width: number;
}

const appShellScreenStyle: ViewStyle = { minHeight: 0 };

function renderNavigationPanel({
  onSessionSelected,
  width,
}: RenderNavigationPanelOptions = {}): React.JSX.Element {
  return (
    <PanelFrame width={width}>
      <NavigationPanelContent onSessionSelected={onSessionSelected} />
    </PanelFrame>
  );
}

function useNavigationPanelWidth(
  theme: Theme,
  windowWidth: number,
): NavigationPanelWidthState {
  const [requestedWidth, setRequestedWidth] = useState(
    (): number => theme.panel.defaultWidth,
  );
  const maxWidth = navigationPanelMaxWidth(theme, windowWidth);
  const width = clampNavigationPanelWidth(
    requestedWidth,
    theme.panel.minWidth,
    maxWidth,
  );

  function handleWidthChange(nextWidth: number): void {
    setRequestedWidth(
      clampNavigationPanelWidth(nextWidth, theme.panel.minWidth, maxWidth),
    );
  }

  return { handleWidthChange, maxWidth, minWidth: theme.panel.minWidth, width };
}

function renderDesktopAppShell(
  navigationPanel: NavigationPanelWidthState,
): React.JSX.Element {
  return (
    <Box
      backgroundColor={appShellBackgroundColor}
      flex={appShellFlex}
      flexDirection={appShellFlexDirection}
      style={appShellScreenStyle}
    >
      {renderNavigationPanel({ width: navigationPanel.width })}
      <NavigationPanelResizeHandle
        maxWidth={navigationPanel.maxWidth}
        minWidth={navigationPanel.minWidth}
        onWidthChange={navigationPanel.handleWidthChange}
        width={navigationPanel.width}
      />
      <SessionScreen />
    </Box>
  );
}

function AppShellScreen(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const { height, width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigationPanel = useNavigationPanelWidth(theme, width);

  function closeDrawer(): void {
    setDrawerOpen(false);
  }

  function openDrawer(): void {
    setDrawerOpen(true);
  }

  if (isWideAppShellLayout(theme, width)) {
    return renderDesktopAppShell(navigationPanel);
  }

  return (
    <MobileAppShell
      drawerOpen={drawerOpen}
      height={height}
      onCloseDrawer={closeDrawer}
      onOpenDrawer={openDrawer}
      renderNavigationPanel={(onSessionSelected) =>
        renderNavigationPanel({ onSessionSelected })
      }
      theme={theme}
      width={width}
    />
  );
}

export { AppShellScreen };
