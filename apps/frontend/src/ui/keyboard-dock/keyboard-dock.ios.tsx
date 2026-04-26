import { useState } from "react";
import type { PropsWithChildren } from "react";
import { InputAccessoryView, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@shopify/restyle";
import type { Theme } from "@/theme";

interface KeyboardDockProps extends PropsWithChildren {
  contentStyle?: StyleProp<ViewStyle> | undefined;
}

const keyboardDockSpacerStyle: ViewStyle = { flexShrink: 0 };

function KeyboardDock({
  children,
  contentStyle,
}: KeyboardDockProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [contentHeight, setContentHeight] = useState(0);

  function handleContentLayout(event: LayoutChangeEvent): void {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setContentHeight((currentHeight) => {
      if (currentHeight === nextHeight) {
        return currentHeight;
      }
      return nextHeight;
    });
  }

  return (
    <>
      <View
        pointerEvents="none"
        style={[keyboardDockSpacerStyle, { height: contentHeight }]}
      />
      <InputAccessoryView backgroundColor={theme.colors.background}>
        <View onLayout={handleContentLayout} style={contentStyle}>
          {children}
        </View>
      </InputAccessoryView>
    </>
  );
}

export { KeyboardDock };
export type { KeyboardDockProps };
