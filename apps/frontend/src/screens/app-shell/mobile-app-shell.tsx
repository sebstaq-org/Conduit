import { Drawer } from "react-native-drawer-layout";
import { SessionScreen } from "@/screens/session";
import {
  appShellDrawerAccessibilityLabel,
  appShellDrawerPosition,
  appShellDrawerType,
  appShellSwipeEdgeWidth,
  appShellSwipeEnabled,
  createAppShellDrawerStyle,
  createAppShellRootStyle,
} from "./app-shell.styles";
import type { Theme } from "@/theme";

interface MobileAppShellProps {
  drawerOpen: boolean;
  height: number;
  onCloseDrawer: () => void;
  onOpenDrawer: () => void;
  renderNavigationPanel: (onSessionSelected: () => void) => React.JSX.Element;
  theme: Theme;
  width: number;
}

function MobileAppShell({
  drawerOpen,
  height,
  onCloseDrawer,
  onOpenDrawer,
  renderNavigationPanel,
  theme,
  width,
}: MobileAppShellProps): React.JSX.Element {
  return (
    <Drawer
      drawerPosition={appShellDrawerPosition}
      drawerStyle={createAppShellDrawerStyle(theme, width)}
      drawerType={appShellDrawerType}
      layout={{ height, width }}
      onClose={onCloseDrawer}
      onOpen={onOpenDrawer}
      open={drawerOpen}
      overlayAccessibilityLabel={appShellDrawerAccessibilityLabel}
      renderDrawerContent={() => renderNavigationPanel(onCloseDrawer)}
      style={createAppShellRootStyle(theme)}
      swipeEdgeWidth={appShellSwipeEdgeWidth}
      swipeEnabled={appShellSwipeEnabled}
    >
      <SessionScreen onOpenNavigationPanel={onOpenDrawer} />
    </Drawer>
  );
}

export { MobileAppShell };
