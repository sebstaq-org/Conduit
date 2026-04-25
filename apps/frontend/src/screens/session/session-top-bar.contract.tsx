import { HostPairingPopover } from "@/features/host-pairing";
import { IconButton } from "@/ui";
import {
  sessionScreenNavigationPanelAccessibilityLabel,
  sessionScreenNavigationPanelIcon,
} from "./session.styles";

function renderSessionScreenTopBarChildren(
  onOpenNavigationPanel: () => void,
): readonly [React.JSX.Element, React.JSX.Element] {
  return [
    <IconButton
      key="navigation"
      accessibilityLabel={sessionScreenNavigationPanelAccessibilityLabel}
      icon={sessionScreenNavigationPanelIcon}
      onPress={onOpenNavigationPanel}
    />,
    <HostPairingPopover key="pairing" />,
  ];
}

export { renderSessionScreenTopBarChildren };
