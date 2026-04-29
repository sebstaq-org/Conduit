import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { KeyboardAvoidingViewProps } from "react-native";
import { keyboardLiftMode } from "./keyboard-lift.contract";
import { keyboardLiftStyle } from "./keyboard-lift.styles";

const iosKeyboardVerticalOffset = 0;

function keyboardLiftBehavior(): KeyboardAvoidingViewProps["behavior"] {
  return "padding";
}

function keyboardLiftVerticalOffset(platform: typeof Platform.OS): number {
  if (platform === "ios") {
    return iosKeyboardVerticalOffset;
  }
  return 0;
}

function KeyboardLift({ children }: PropsWithChildren): React.JSX.Element {
  if (keyboardLiftMode(Platform.OS) === "plain") {
    return <View style={keyboardLiftStyle}>{children}</View>;
  }

  return (
    <KeyboardAvoidingView
      behavior={keyboardLiftBehavior()}
      contentContainerStyle={keyboardLiftStyle}
      keyboardVerticalOffset={keyboardLiftVerticalOffset(Platform.OS)}
      style={keyboardLiftStyle}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export { KeyboardLift };
