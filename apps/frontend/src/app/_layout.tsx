import { Stack } from "expo-router";
import { ConduitThemeProvider } from "@/theme";

export default function RootLayout(): React.JSX.Element {
  return (
    <ConduitThemeProvider mode="light">
      <Stack screenOptions={{ headerShown: false }} />
    </ConduitThemeProvider>
  );
}
