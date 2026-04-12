import type { Theme } from "@/theme";

interface SessionComposerPreviewControl {
  label: string;
  value: string;
}

const sessionComposerAccessibilityLabel = "Session message";
const sessionComposerBackgroundColor = "composerSurface" as const;
const sessionComposerBorderColor = "borderSubtle" as const;
const sessionComposerBorderRadius = "panel" as const;
const sessionComposerControlBackgroundColor =
  "composerControlBackground" as const;
const sessionComposerControlBorderRadius = "row" as const;
const sessionComposerControlGap = "xxs" as const;
const sessionComposerControlTextVariant = "meta" as const;
const sessionComposerGap = "sm" as const;
const sessionComposerPaddingX = "md" as const;
const sessionComposerPaddingY = "sm" as const;
const sessionComposerPlaceholder =
  "Ask Codex anything, @ to add files, / for commands, $ for skills";
const sessionComposerRowAlignItems = "center" as const;
const sessionComposerRowFlexDirection = "row" as const;
const sessionComposerRowJustifyContent = "space-between" as const;
const sessionComposerSendAccessibilityLabel = "Send message";
const sessionComposerSendIcon = "arrow-up" as const;

interface SessionComposerSurfaceStyle {
  minHeight: number;
}

interface SessionComposerControlStyle {
  minHeight: number;
  paddingLeft: number;
  paddingRight: number;
}

function createSessionComposerSurfaceStyle(
  theme: Theme,
): SessionComposerSurfaceStyle {
  return { minHeight: theme.panel.composerSurfaceMinHeight };
}

function createSessionComposerControlStyle(
  theme: Theme,
): SessionComposerControlStyle {
  return {
    minHeight: theme.panel.iconButton,
    paddingLeft: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
  };
}

export {
  createSessionComposerControlStyle,
  createSessionComposerSurfaceStyle,
  sessionComposerAccessibilityLabel,
  sessionComposerBackgroundColor,
  sessionComposerBorderColor,
  sessionComposerBorderRadius,
  sessionComposerControlBackgroundColor,
  sessionComposerControlBorderRadius,
  sessionComposerControlGap,
  sessionComposerControlTextVariant,
  sessionComposerGap,
  sessionComposerPaddingX,
  sessionComposerPaddingY,
  sessionComposerPlaceholder,
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
  sessionComposerRowJustifyContent,
  sessionComposerSendAccessibilityLabel,
  sessionComposerSendIcon,
};
export type { SessionComposerPreviewControl };
