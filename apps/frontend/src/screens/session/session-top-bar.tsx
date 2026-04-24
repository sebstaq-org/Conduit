import { Box } from "@/theme";
import {
  sessionTopBarAlignItems,
  sessionTopBarFlexDirection,
  sessionTopBarJustifyContent,
} from "./session.styles";
import { renderSessionScreenTopBarChildren } from "./session-top-bar.contract";

interface SessionScreenTopBarProps {
  readonly onOpenNavigationPanel: () => void;
}

function SessionScreenTopBar({
  onOpenNavigationPanel,
}: SessionScreenTopBarProps): React.JSX.Element {
  const [navigationButton, pairingPopover] =
    renderSessionScreenTopBarChildren(onOpenNavigationPanel);

  return (
    <Box
      alignItems={sessionTopBarAlignItems}
      flexDirection={sessionTopBarFlexDirection}
      justifyContent={sessionTopBarJustifyContent}
    >
      {navigationButton}
      {pairingPopover}
    </Box>
  );
}

export { SessionScreenTopBar };
