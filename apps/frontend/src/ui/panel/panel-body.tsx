import type { ReactNode } from "react";
import { Box } from "@/theme";
import {
  panelBodyFlex,
  panelBodyPaddingTop,
  panelBodyPaddingX,
} from "./panel.styles";

interface PanelBodyProps {
  children: ReactNode;
}

function PanelBody({ children }: PanelBodyProps): React.JSX.Element {
  return (
    <Box flex={panelBodyFlex} px={panelBodyPaddingX} pt={panelBodyPaddingTop}>
      {children}
    </Box>
  );
}

export { PanelBody };
