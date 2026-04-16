import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { initializeFrontendLogging } from "@/app-state/frontend-logger";
import { RootLayoutStore } from "@/shell/root-layout-store";
import { rootLayoutGestureHandlerRootStyle } from "@/shell/root-layout.styles";

initializeFrontendLogging();

export default function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={rootLayoutGestureHandlerRootStyle}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <RootLayoutStore />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
