import type { ReactNode } from "react";
import { View } from "react-native";
import { panelStyles } from "./panel.styles";

interface PanelBodyProps {
  children: ReactNode;
}

function PanelBody({ children }: PanelBodyProps): React.JSX.Element {
  return <View style={panelStyles.body}>{children}</View>;
}

export { PanelBody };
