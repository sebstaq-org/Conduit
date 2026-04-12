import type { SessionTranscriptMessageRole } from "./session-transcript.types";
import type { MarkdownStyle } from "react-native-enriched-markdown";
import type { Theme } from "@/theme";

const sessionTranscriptGap = "lg" as const;
const sessionTranscriptMetaVariant = "sectionTitle" as const;
const sessionTranscriptRowGap = "xs" as const;
const sessionTranscriptTextVariant = "rowLabel" as const;

function createSessionTranscriptMarkdownStyle(theme: Theme): MarkdownStyle {
  return {
    code: {
      backgroundColor: theme.colors.composerSurface,
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    codeBlock: {
      backgroundColor: theme.colors.composerSurface,
      borderColor: theme.colors.borderSubtle,
      borderRadius: theme.borderRadii.row,
      borderWidth: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    h1: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 22,
      marginBottom: theme.spacing.xs,
      marginTop: 0,
    },
    list: {
      bulletColor: theme.colors.textMuted,
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    paragraph: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: theme.spacing.xs,
      marginTop: 0,
    },
    strong: {
      color: theme.colors.textPrimary,
    },
  };
}

function sessionTranscriptRoleLabel(
  role: SessionTranscriptMessageRole,
): string {
  if (role === "user") {
    return "You";
  }

  return "Assistant";
}

export {
  sessionTranscriptGap,
  createSessionTranscriptMarkdownStyle,
  sessionTranscriptMetaVariant,
  sessionTranscriptRoleLabel,
  sessionTranscriptRowGap,
  sessionTranscriptTextVariant,
};
