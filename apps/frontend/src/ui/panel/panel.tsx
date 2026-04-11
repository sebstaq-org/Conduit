import type { ReactNode } from "react";
import { useTheme } from "@shopify/restyle";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import {
  createPanelContainerStyle,
  panelHostBackgroundColor,
  panelHostFlex,
  panelHostFlexDirection,
} from "./panel.styles";

interface PanelHostProps {
  children: ReactNode;
}

function PanelHost({ children }: PanelHostProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Box
      backgroundColor={panelHostBackgroundColor}
      flex={panelHostFlex}
      flexDirection={panelHostFlexDirection}
    >
      <SafeAreaView style={createPanelContainerStyle(theme)}>
        {children}
      </SafeAreaView>
      <Box backgroundColor={panelHostBackgroundColor} flex={panelHostFlex} />
    </Box>
  );
}

export { PanelHost };
