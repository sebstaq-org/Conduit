import type { PropsWithChildren } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

interface KeyboardDockProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle> | undefined;
}

function KeyboardDock({
  children,
  contentStyle,
}: KeyboardDockProps): React.JSX.Element {
  return <View style={contentStyle}>{children}</View>;
}

export { KeyboardDock };
export type { KeyboardDockProps };
