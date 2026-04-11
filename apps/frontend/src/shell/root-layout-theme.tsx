import { Stack } from "expo-router";
import { ConduitThemeProvider } from "@/theme";

function RootLayoutTheme(): React.JSX.Element {
  return (
    <ConduitThemeProvider mode="light">
      <Stack screenOptions={{ headerShown: false }} />
    </ConduitThemeProvider>
  );
}

export { RootLayoutTheme };
