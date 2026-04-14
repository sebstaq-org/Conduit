import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { useDispatch, useSelector } from "react-redux";
import {
  canSubmitPrompt,
  draftSessionProviderSelected,
  selectActiveSession,
  submitPrompt,
  useNewSessionMutation,
  usePromptSessionMutation,
} from "@/app-state";
import type { ActiveSession } from "@/app-state";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import type { ProviderId } from "@conduit/session-client";
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

interface SessionComposerSurfaceArgs {
  activeSession: ActiveSession | null;
  canSend: boolean;
  dispatch: ReturnType<typeof useDispatch>;
  draft: string;
  hasError: boolean;
  handleSend: () => void;
  setDraft: (draft: string) => void;
  theme: Theme;
}

function renderComposerError(hasError: boolean): React.JSX.Element | null {
  if (!hasError) {
    return null;
  }
  return <Text variant="rowLabelMuted">Message failed to send</Text>;
}

function selectDraftProvider(
  dispatch: ReturnType<typeof useDispatch>,
  provider: ProviderId,
): void {
  dispatch(draftSessionProviderSelected(provider));
}

function renderSessionComposerSurface({
  activeSession,
  canSend,
  dispatch,
  draft,
  handleSend,
  hasError,
  setDraft,
  theme,
}: SessionComposerSurfaceArgs): React.JSX.Element {
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
        onSend={handleSend}
        isDraft={activeSession?.kind === "draft"}
        onProviderSelect={(provider) => {
          selectDraftProvider(dispatch, provider);
        }}
        provider={activeSession?.provider ?? null}
      />
      {renderComposerError(hasError)}
    </Box>
  );
}

function SessionComposer(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const dispatch = useDispatch();
  const activeSession = useSelector(selectActiveSession);
  const [newSession, newSessionState] = useNewSessionMutation();
  const [promptSession, promptSessionState] = usePromptSessionMutation();
  const [draft, setDraft] = useState("");
  const trimmedDraft = draft.trim();
  const canSend = canSubmitPrompt(
    activeSession,
    promptSessionState.isLoading || newSessionState.isLoading,
    trimmedDraft,
  );

  function handleSend(): void {
    if (canSend && activeSession !== null) {
      void submitPrompt({
        activeSession,
        newSession,
        promptSession,
        setDraft,
        text: trimmedDraft,
      });
    }
  }

  return renderSessionComposerSurface({
    activeSession,
    canSend,
    dispatch,
    draft,
    handleSend,
    hasError: promptSessionState.isError || newSessionState.isError,
    setDraft,
    theme,
  });
}

export { SessionComposer };
