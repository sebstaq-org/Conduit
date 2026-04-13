import { Platform } from "react-native";
import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

function createModalOverlayStyle(): ViewStyle {
  return {
    backgroundColor: "rgba(0, 0, 0, 0.36)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  };
}

function createModalContainerStyle(theme: Theme): ViewStyle {
  return {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    padding: theme.spacing.lg,
    position: "absolute",
    right: 0,
    top: 0,
  };
}

function createModalContentStyle(theme: Theme): ViewStyle {
  const contentStyle: ViewStyle = {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.borderRadii.panel,
    borderWidth: 1,
    maxWidth: 380,
    padding: theme.spacing.sm,
    width: "100%",
  };

  if (Platform.OS === "web") {
    return Object.assign(contentStyle, {
      boxShadow: "0 14px 28px rgba(0, 0, 0, 0.2)",
    } satisfies ViewStyle);
  }

  return Object.assign(contentStyle, {
    elevation: 10,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
  } satisfies ViewStyle);
}

export {
  createModalContainerStyle,
  createModalContentStyle,
  createModalOverlayStyle,
};
