import { useTheme } from "@shopify/restyle";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import {
  createModalContainerStyle,
  createModalContentStyle,
} from "./modal.styles";

interface ModalContentProps {
  children: ReactNode;
}

function ModalContent({ children }: ModalContentProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <View pointerEvents="box-none" style={createModalContainerStyle(theme)}>
      <Box style={createModalContentStyle(theme)}>{children}</Box>
    </View>
  );
}

export { ModalContent };
