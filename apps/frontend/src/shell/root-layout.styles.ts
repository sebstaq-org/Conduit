import type { ViewStyle } from "react-native";
import type { Edge } from "react-native-safe-area-context";

const rootLayoutGestureHandlerRootStyle: ViewStyle = { flex: 1 };
const rootLayoutSafeAreaEdges: Edge[] = ["bottom", "left", "right", "top"];
const rootLayoutSafeAreaStyle: ViewStyle = { flex: 1 };

export {
  rootLayoutGestureHandlerRootStyle,
  rootLayoutSafeAreaEdges,
  rootLayoutSafeAreaStyle,
};
