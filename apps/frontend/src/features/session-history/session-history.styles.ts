import type { MarkdownStyle } from "react-native-enriched-markdown";
import type { Theme } from "@/theme";

const historyAgentRowAlignItems = "flex-start" as const;
const historyListGap = "lg" as const;
const historyStatusVariant = "rowLabelMuted" as const;
const historyUserBubbleBackgroundColor = "sessionUserBubble" as const;
const historyUserRowAlignItems = "flex-end" as const;

interface HistoryListStyle {
  alignSelf: "center";
  maxWidth: number;
  width: "100%";
}

interface HistoryUserBubbleStyle {
  borderRadius: number;
  maxWidth: "76%";
  paddingHorizontal: number;
  paddingVertical: number;
}

interface HistoryUserTextStyle {
  color: string;
  fontSize: number;
  fontWeight: "400";
  lineHeight: number;
}

function createHistoryAgentMarkdownStyle(theme: Theme): MarkdownStyle {
  return {
    code: {
      backgroundColor: theme.colors.composerSurface,
      color: theme.colors.sessionAgentText,
      fontSize: 14,
    },
    codeBlock: {
      backgroundColor: theme.colors.composerSurface,
      borderColor: theme.colors.borderSubtle,
      borderRadius: theme.borderRadii.row,
      borderWidth: 1,
      color: theme.colors.sessionAgentText,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    h1: {
      color: theme.colors.sessionAgentText,
      fontSize: 18,
      fontWeight: "600",
      lineHeight: 24,
      marginBottom: theme.spacing.xs,
      marginTop: 0,
    },
    list: {
      bulletColor: theme.colors.textMuted,
      color: theme.colors.sessionAgentText,
      fontSize: 16,
      lineHeight: 24,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    paragraph: {
      color: theme.colors.sessionAgentText,
      fontSize: 16,
      lineHeight: 24,
      marginBottom: theme.spacing.xs,
      marginTop: 0,
    },
    strong: {
      color: theme.colors.sessionAgentText,
    },
  };
}

function createHistoryListStyle(theme: Theme): HistoryListStyle {
  return {
    alignSelf: "center",
    maxWidth: Math.min(760, theme.breakpoints.web),
    width: "100%",
  };
}

function createHistoryUserBubbleStyle(theme: Theme): HistoryUserBubbleStyle {
  return {
    borderRadius: 16,
    maxWidth: "76%",
    paddingHorizontal: theme.spacing.contentX,
    paddingVertical: theme.spacing.sm,
  };
}

function createHistoryUserTextStyle(theme: Theme): HistoryUserTextStyle {
  return {
    color: theme.colors.sessionUserBubbleText,
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  };
}

export {
  createHistoryAgentMarkdownStyle,
  createHistoryListStyle,
  createHistoryUserBubbleStyle,
  createHistoryUserTextStyle,
  historyAgentRowAlignItems,
  historyListGap,
  historyStatusVariant,
  historyUserBubbleBackgroundColor,
  historyUserRowAlignItems,
};
