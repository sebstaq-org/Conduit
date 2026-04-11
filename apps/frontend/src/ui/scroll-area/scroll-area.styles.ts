import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

function createScrollAreaContentStyle(theme: Theme): ViewStyle {
  return { paddingBottom: theme.spacing.scrollBottom };
}

const scrollAreaStyle = { flex: 1 } as const;

export { createScrollAreaContentStyle, scrollAreaStyle };
