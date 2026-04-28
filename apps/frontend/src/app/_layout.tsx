import { wrap as wrapSentryRoot } from "@sentry/react-native";
import { closeMenu as closeDevClientMenu } from "expo-dev-client";
// @ts-expect-error react-native-get-random-values is an untyped native polyfill.
import randomValuesPolyfill from "react-native-get-random-values";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { initializeFrontendLogging } from "@/app-state/frontend-logger";
import { RootLayoutStore } from "@/shell/root-layout-store";
import { rootLayoutGestureHandlerRootStyle } from "@/shell/root-layout.styles";

initializeFrontendLogging();
void closeDevClientMenu;
void randomValuesPolyfill;

function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={rootLayoutGestureHandlerRootStyle}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <RootLayoutStore />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const SentryWrappedRootLayout = wrapSentryRoot(RootLayout);

export default SentryWrappedRootLayout;
