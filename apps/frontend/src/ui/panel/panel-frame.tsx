import type { ReactNode } from "react";
import { useTheme } from "@shopify/restyle";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Theme } from "@/theme";
import { createPanelContainerStyle } from "./panel.styles";

interface PanelFrameProps {
  children: ReactNode;
}

function PanelFrame({ children }: PanelFrameProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <SafeAreaView style={createPanelContainerStyle(theme)}>
      {children}
    </SafeAreaView>
  );
}

export { PanelFrame };
