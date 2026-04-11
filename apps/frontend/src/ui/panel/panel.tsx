import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { panelStyles } from "./panel.styles";

interface PanelHostProps {
  children: ReactNode;
}

function PanelHost({ children }: PanelHostProps): React.JSX.Element {
  return (
    <View style={panelStyles.host}>
      <SafeAreaView style={panelStyles.panel}>{children}</SafeAreaView>
      <View style={panelStyles.remainder} />
    </View>
  );
}

export { PanelHost };
