import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootLayoutStore } from "@/shell/root-layout-store";
import { rootLayoutGestureHandlerRootStyle } from "@/shell/root-layout.styles";

export default function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={rootLayoutGestureHandlerRootStyle}>
      <RootLayoutStore />
    </GestureHandlerRootView>
  );
}
