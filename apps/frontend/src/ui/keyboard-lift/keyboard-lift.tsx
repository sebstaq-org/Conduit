import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import type { KeyboardAvoidingViewProps } from "react-native";
import { keyboardLiftStyle } from "./keyboard-lift.styles";

function keyboardLiftBehavior(): KeyboardAvoidingViewProps["behavior"] {
  if (Platform.OS === "ios") {
    return "padding";
  }
  if (Platform.OS === "android") {
    return "height";
  }
  return undefined;
}

function KeyboardLift({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      behavior={keyboardLiftBehavior()}
      style={keyboardLiftStyle}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export { KeyboardLift };
