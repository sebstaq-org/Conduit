import type { ReactNode } from "react";
import { Box } from "@/theme";
import {
  panelHostBackgroundColor,
  panelHostFlex,
  panelHostFlexDirection,
} from "./panel.styles";
import { PanelFrame } from "./panel-frame";

interface PanelHostProps {
  children: ReactNode;
}

function PanelHost({ children }: PanelHostProps): React.JSX.Element {
  return (
    <Box
      backgroundColor={panelHostBackgroundColor}
      flex={panelHostFlex}
      flexDirection={panelHostFlexDirection}
    >
      <PanelFrame>{children}</PanelFrame>
      <Box backgroundColor={panelHostBackgroundColor} flex={panelHostFlex} />
    </Box>
  );
}

export { PanelHost };
