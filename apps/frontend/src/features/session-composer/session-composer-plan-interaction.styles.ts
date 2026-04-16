import type { TextStyle, ViewStyle } from "react-native";
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

function createPlanInteractionTerminalOtherInputStyle(): ViewStyle {
  return {
    flex: 1,
    minWidth: 0,
  };
}

function createPlanInteractionTerminalPrefixStyle(): TextStyle {
  return {
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    width: 20,
  };
}

function createPlanInteractionTerminalOtherRowStyle(theme: Theme): ViewStyle {
  return {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: theme.panel.rowHeight,
    paddingHorizontal: theme.spacing.sm,
    width: "100%",
  };
}

export {
  createPlanInteractionEscStyle,
  createPlanInteractionFooterStyle,
  createPlanInteractionHeaderStyle,
  createPlanInteractionInlineInputStyle,
  createPlanInteractionTerminalOtherInputStyle,
  createPlanInteractionTerminalOtherRowStyle,
  createPlanInteractionTerminalPrefixStyle,
};
