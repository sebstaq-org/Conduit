import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConduitThemeProvider } from "@/theme";
import {
  rootLayoutSafeAreaEdges,
  rootLayoutSafeAreaStyle,
} from "./root-layout.styles";

function RootLayoutTheme(): React.JSX.Element {
  return (
    <ConduitThemeProvider mode="light">
      <SafeAreaView
        edges={rootLayoutSafeAreaEdges}
        style={rootLayoutSafeAreaStyle}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
    </ConduitThemeProvider>
  );
}

export { RootLayoutTheme };
