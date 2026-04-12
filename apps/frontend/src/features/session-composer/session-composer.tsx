import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { useSelector } from "react-redux";
import {
  canSubmitPrompt,
  selectActiveSession,
  submitPrompt,
  usePromptSessionMutation,
} from "@/app-state";
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

function SessionComposer(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const activeSession = useSelector(selectActiveSession);
  const [promptSession, promptSessionState] = usePromptSessionMutation();
  const [draft, setDraft] = useState("");
  const trimmedDraft = draft.trim();
  const canSend = canSubmitPrompt(
    activeSession,
    promptSessionState.isLoading,
    trimmedDraft,
  );

  function handleSend(): void {
    if (!canSend || activeSession === null) {
      return;
    }

    void submitPrompt({
      activeSession,
      promptSession,
      setDraft,
      text: trimmedDraft,
    });
  }

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
        provider={activeSession?.provider}
      />
      {promptSessionState.isError && (
        <Text variant="rowLabelMuted">Message failed to send</Text>
      )}
    </Box>
  );
}

export { SessionComposer };
