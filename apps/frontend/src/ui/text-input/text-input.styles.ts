import type { TextStyle } from "react-native";

const webTextInputFocusReset: TextStyle = {
  // @ts-expect-error React Native Web supports `none`; React Native's TextStyle type omits it.
  outlineStyle: "none",
  outlineWidth: 0,
};

export { webTextInputFocusReset };
