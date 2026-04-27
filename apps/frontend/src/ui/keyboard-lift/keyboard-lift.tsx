import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { KeyboardAvoidingViewProps } from "react-native";
import { keyboardLiftStyle } from "./keyboard-lift.styles";

const androidKeyboardVerticalOffset = 64;
const iosKeyboardVerticalOffset = 0;

function keyboardLiftBehavior(): KeyboardAvoidingViewProps["behavior"] {
  if (Platform.OS === "ios") {
    return "padding";
  }
  if (Platform.OS === "android") {
    return "position";
  }
  return undefined;
}

function keyboardLiftVerticalOffset(): number {
  if (Platform.OS === "ios") {
    return iosKeyboardVerticalOffset;
  }
  return androidKeyboardVerticalOffset;
}

function KeyboardLift({ children }: PropsWithChildren): React.JSX.Element {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return <View style={keyboardLiftStyle}>{children}</View>;
  }

  return (
    <KeyboardAvoidingView
      behavior={keyboardLiftBehavior()}
      contentContainerStyle={keyboardLiftStyle}
      keyboardVerticalOffset={keyboardLiftVerticalOffset()}
      style={keyboardLiftStyle}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export { KeyboardLift };
