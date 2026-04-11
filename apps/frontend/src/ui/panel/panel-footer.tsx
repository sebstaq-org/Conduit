import type { ReactNode } from "react";
import { View } from "react-native";
import { panelStyles } from "./panel.styles";

interface PanelFooterProps {
  children: ReactNode;
}

function PanelFooter({ children }: PanelFooterProps): React.JSX.Element {
  return <View style={panelStyles.footer}>{children}</View>;
}

export { PanelFooter };
