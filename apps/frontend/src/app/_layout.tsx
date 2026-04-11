import { Stack } from "expo-router";
import { ConduitStoreProvider } from "@/app-state";
import { ConduitThemeProvider } from "@/theme";

export default function RootLayout(): React.JSX.Element {
  return (
    <ConduitStoreProvider>
      <ConduitThemeProvider mode="light">
        <Stack screenOptions={{ headerShown: false }} />
      </ConduitThemeProvider>
    </ConduitStoreProvider>
  );
}
