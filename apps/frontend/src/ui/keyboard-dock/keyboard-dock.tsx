import type { PropsWithChildren } from "react";
import { View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";

interface KeyboardDockProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle> | undefined;
  onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
}

function KeyboardDock({
  children,
  contentStyle,
  onLayout,
}: KeyboardDockProps): React.JSX.Element {
  return (
    <View onLayout={onLayout} style={contentStyle}>
      {children}
    </View>
  );
}

export { KeyboardDock };
export type { KeyboardDockProps };
