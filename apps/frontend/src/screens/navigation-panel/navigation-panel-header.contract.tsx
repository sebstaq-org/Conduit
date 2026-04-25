import { DesktopPairingPopover } from "@/features/desktop-pairing";
import { HostPairingPopover } from "@/features/host-pairing";
import { Text } from "@/theme";
import { navigationPanelHeadingVariant } from "./navigation-panel.styles";

function renderNavigationPanelHeaderPairingPopover(
  desktopShell: boolean,
): React.JSX.Element {
  if (desktopShell) {
    return <DesktopPairingPopover key="pairing" />;
  }

  return <HostPairingPopover key="pairing" />;
}

function renderNavigationPanelHeaderChildren(
  desktopShell: boolean,
): readonly [React.JSX.Element, React.JSX.Element] {
  return [
    <Text key="title" variant={navigationPanelHeadingVariant}>
      Conduit
    </Text>,
    renderNavigationPanelHeaderPairingPopover(desktopShell),
  ];
}

export { renderNavigationPanelHeaderChildren };
