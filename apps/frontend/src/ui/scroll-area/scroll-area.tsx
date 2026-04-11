import type { ReactNode } from "react";
import { useTheme } from "@shopify/restyle";
import { ScrollView } from "react-native";
import type { Theme } from "@/theme";
import {
  createScrollAreaContentStyle,
  scrollAreaStyle,
} from "./scroll-area.styles";

interface ScrollAreaProps {
  children: ReactNode;
}

function ScrollArea({ children }: ScrollAreaProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <ScrollView
      contentContainerStyle={createScrollAreaContentStyle(theme)}
      showsVerticalScrollIndicator={false}
      style={scrollAreaStyle}
    >
      {children}
    </ScrollView>
  );
}

export { ScrollArea };
