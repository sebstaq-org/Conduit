import { desktopBridgeAvailable } from "@/app-state/desktop-bridge";
import { Box } from "@/theme";
import { navigationPanelHeadingMarginBottom } from "./navigation-panel.styles";
import { renderNavigationPanelHeaderChildren } from "./navigation-panel-header.contract";

function NavigationPanelHeader(): React.JSX.Element {
  const [title, pairingPopover] = renderNavigationPanelHeaderChildren(
    desktopBridgeAvailable(),
  );

  return (
    <Box
      alignItems="center"
      flexDirection="row"
      justifyContent="space-between"
      mb={navigationPanelHeadingMarginBottom}
    >
      {title}
      {pairingPopover}
    </Box>
  );
}

export { NavigationPanelHeader };
