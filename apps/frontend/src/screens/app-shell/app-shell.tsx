import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { useWindowDimensions } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { NavigationPanelContent } from "@/screens/navigation-panel/navigation-panel-content";
import { SessionScreen } from "@/screens/session";
import { PanelFrame } from "@/ui";
import {
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
} from "./app-shell.styles";

function renderNavigationPanel(): React.JSX.Element {
  return (
    <PanelFrame>
      <NavigationPanelContent />
    </PanelFrame>
  );
}

function AppShellScreen(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const { height, width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <Drawer
      drawerPosition={appShellDrawerPosition}
      drawerStyle={createAppShellDrawerStyle(theme, width)}
      drawerType={appShellDrawerType}
      layout={{ height, width }}
      onClose={() => {
        setDrawerOpen(false);
      }}
      onOpen={() => {
        setDrawerOpen(true);
      }}
      open={drawerOpen}
      overlayAccessibilityLabel={appShellDrawerAccessibilityLabel}
      renderDrawerContent={renderNavigationPanel}
      style={createAppShellRootStyle(theme)}
      swipeEdgeWidth={appShellSwipeEdgeWidth}
      swipeEnabled={appShellSwipeEnabled}
    >
      <SessionScreen />
    </Drawer>
  );
}

export { AppShellScreen };
