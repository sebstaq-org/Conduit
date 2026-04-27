import type { PropsWithChildren } from "react";
import { Keyboard, Pressable } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

interface KeyboardDismissViewProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle> | undefined;
}

function KeyboardDismissView({
  children,
  style,
}: KeyboardDismissViewProps): React.JSX.Element {
  function handlePress(): void {
    Keyboard.dismiss();
  }

  return (
    <Pressable accessible={false} onPress={handlePress} style={style}>
      {children}
    </Pressable>
  );
}

export { KeyboardDismissView };
