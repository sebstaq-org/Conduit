import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { scrollAreaStyles } from "./scroll-area.styles";

interface ScrollAreaProps {
  children: ReactNode;
}

function ScrollArea({ children }: ScrollAreaProps): React.JSX.Element {
  return (
    <ScrollView
      contentContainerStyle={scrollAreaStyles.content}
      showsVerticalScrollIndicator={false}
      style={scrollAreaStyles.scrollArea}
    >
      {children}
    </ScrollView>
  );
}

export { ScrollArea };
