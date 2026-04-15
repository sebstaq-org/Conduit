import type { ProviderId, SessionConfigOption } from "@conduit/session-client";
import type { ActiveSession } from "@/app-state";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { SessionComposerActionRow } from "./session-composer-action-row";
import { SessionComposerInput } from "./session-composer-input";
import {
  createSessionComposerSurfaceStyle,
  sessionComposerBackgroundColor,
  sessionComposerBorderColor,
  sessionComposerBorderRadius,
  sessionComposerGap,
  sessionComposerPaddingX,
  sessionComposerPaddingY,
} from "./session-composer.styles";

interface SessionComposerSurfaceProps {
  activeSession: ActiveSession | null;
  canSend: boolean;
  configOptions: SessionConfigOption[] | null;
  draft: string;
  errorMessage: string | null;
  onConfigOptionSelect: (configId: string, value: string) => void;
  onProviderSelect: (provider: ProviderId) => void;
  onSend: () => void;
  isConfigUpdating: boolean;
  setDraft: (draft: string) => void;
  theme: Theme;
}

function renderComposerErrorMessage(
  message: string | null,
): React.JSX.Element | null {
  if (message === null) {
    return null;
  }
  return <Text variant="rowLabelMuted">{message}</Text>;
}

function SessionComposerSurface({
  activeSession,
  canSend,
  configOptions,
  draft,
  errorMessage,
  onConfigOptionSelect,
  onProviderSelect,
  onSend,
  isConfigUpdating,
  setDraft,
  theme,
}: SessionComposerSurfaceProps): React.JSX.Element {
  return (
    <Box
      backgroundColor={sessionComposerBackgroundColor}
      borderColor={sessionComposerBorderColor}
      borderRadius={sessionComposerBorderRadius}
      borderWidth={1}
      gap={sessionComposerGap}
      px={sessionComposerPaddingX}
      py={sessionComposerPaddingY}
      style={createSessionComposerSurfaceStyle(theme)}
    >
      <SessionComposerInput draft={draft} setDraft={setDraft} />
      <SessionComposerActionRow
        canSend={canSend}
        configOptions={configOptions}
        isUpdatingConfig={isConfigUpdating}
        onSend={onSend}
        isDraft={activeSession?.kind === "draft"}
        onConfigOptionSelect={onConfigOptionSelect}
        onProviderSelect={onProviderSelect}
        provider={activeSession?.provider ?? null}
      />
      {renderComposerErrorMessage(errorMessage)}
    </Box>
  );
}

export { SessionComposerSurface };
