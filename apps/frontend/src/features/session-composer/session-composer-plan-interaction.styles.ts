import type { ViewStyle } from "react-native";
import type { Theme } from "@/theme";

function createPlanInteractionHeaderStyle(): ViewStyle {
  return {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  };
}

function createPlanInteractionFooterStyle(): ViewStyle {
  return {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
    width: "100%",
  };
}

function createPlanInteractionEscStyle(theme: Theme): ViewStyle {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.composerControlBackground,
    borderRadius: theme.borderRadii.row,
    minHeight: 22,
    paddingHorizontal: theme.spacing.xs,
  };
}

function createPlanInteractionInlineInputStyle(theme: Theme): ViewStyle {
  return {
    backgroundColor: theme.colors.composerControlBackground,
    borderRadius: theme.borderRadii.row,
    paddingHorizontal: theme.spacing.sm,
  };
}

export {
  createPlanInteractionEscStyle,
  createPlanInteractionFooterStyle,
  createPlanInteractionHeaderStyle,
  createPlanInteractionInlineInputStyle,
};
