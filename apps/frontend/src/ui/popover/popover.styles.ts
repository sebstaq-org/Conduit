import { Platform } from "react-native";
import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

const popoverContentAlign = "end" as const;
const popoverContentSide = "bottom" as const;
const popoverContentSideOffset = 6;

function createPopoverContentStyle(theme: Theme): ViewStyle {
  const contentStyle: ViewStyle = {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.borderRadii.panel,
    borderWidth: 1,
    maxWidth: 360,
    padding: theme.spacing.sm,
    width: 320,
  };

  if (Platform.OS === "web") {
    return Object.assign(contentStyle, {
      boxShadow: "0 8px 18px rgba(0, 0, 0, 0.12)",
    } satisfies ViewStyle);
  }

  return Object.assign(contentStyle, {
    elevation: 8,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  } satisfies ViewStyle);
}

function createPopoverOverlayStyle(): ViewStyle {
  return {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  };
}

export {
  createPopoverContentStyle,
  createPopoverOverlayStyle,
  popoverContentAlign,
  popoverContentSide,
  popoverContentSideOffset,
};
