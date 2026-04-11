import type { ReactNode } from "react";
import { Box } from "@/theme";
import {
  panelFooterPaddingBottom,
  panelFooterPaddingTop,
} from "./panel.styles";

interface PanelFooterProps {
  children: ReactNode;
}

function PanelFooter({ children }: PanelFooterProps): React.JSX.Element {
  return (
    <Box pb={panelFooterPaddingBottom} pt={panelFooterPaddingTop}>
      {children}
    </Box>
  );
}

export { PanelFooter };
