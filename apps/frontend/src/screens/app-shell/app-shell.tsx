import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { useWindowDimensions } from "react-native";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { NavigationPanelContent } from "@/screens/navigation-panel/navigation-panel-content";
import { SessionScreen } from "@/screens/session";
import { PanelFrame } from "@/ui";
import { MobileAppShell } from "./mobile-app-shell";
import {
  appShellBackgroundColor,
  appShellFlex,
  appShellFlexDirection,
  isWideAppShellLayout,
} from "./app-shell.styles";

interface RenderNavigationPanelOptions {
  onSessionSelected?: (() => void) | undefined;
}

function renderNavigationPanel({
  onSessionSelected,
}: RenderNavigationPanelOptions = {}): React.JSX.Element {
  return (
    <PanelFrame>
      <NavigationPanelContent onSessionSelected={onSessionSelected} />
    </PanelFrame>
  );
}

function AppShellScreen(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const { height, width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function closeDrawer(): void {
    setDrawerOpen(false);
  }

  function openDrawer(): void {
    setDrawerOpen(true);
  }

  if (isWideAppShellLayout(theme, width)) {
    return (
      <Box
        backgroundColor={appShellBackgroundColor}
        flex={appShellFlex}
        flexDirection={appShellFlexDirection}
      >
        {renderNavigationPanel()}
        <SessionScreen />
      </Box>
    );
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
