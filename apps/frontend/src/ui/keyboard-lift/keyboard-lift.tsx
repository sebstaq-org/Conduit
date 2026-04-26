import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { KeyboardAvoidingViewProps } from "react-native";
import { keyboardLiftStyle } from "./keyboard-lift.styles";

const androidKeyboardVerticalOffset = 64;

function keyboardLiftBehavior(): KeyboardAvoidingViewProps["behavior"] {
  if (Platform.OS === "android") {
    return "position";
  }
  return undefined;
}

function KeyboardLift({ children }: PropsWithChildren): React.JSX.Element {
  if (Platform.OS !== "android") {
    return <View style={keyboardLiftStyle}>{children}</View>;
  }

  return (
    <KeyboardAvoidingView
      behavior={keyboardLiftBehavior()}
      contentContainerStyle={keyboardLiftStyle}
      keyboardVerticalOffset={androidKeyboardVerticalOffset}
      style={keyboardLiftStyle}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export { KeyboardLift };
