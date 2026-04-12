import { useState } from "react";
import { useTheme } from "@shopify/restyle";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { MultilineInput } from "@/ui";
import { SessionComposerActionRow } from "./session-composer-action-row";
import {
  createSessionComposerSurfaceStyle,
  sessionComposerAccessibilityLabel,
  sessionComposerBackgroundColor,
  sessionComposerBorderColor,
  sessionComposerBorderRadius,
  sessionComposerGap,
  sessionComposerPaddingX,
  sessionComposerPaddingY,
  sessionComposerPlaceholder,
} from "./session-composer.styles";

function SessionComposer(): React.JSX.Element {
  const theme = useTheme<Theme>();
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0;

  function handleMockSend(): void {
    if (!canSend) {
      return;
    }

    setDraft("");
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
      <MultilineInput
        accessibilityLabel={sessionComposerAccessibilityLabel}
        onChangeText={setDraft}
        placeholder={sessionComposerPlaceholder}
        value={draft}
      />
      <SessionComposerActionRow canSend={canSend} onMockSend={handleMockSend} />
    </Box>
  );
}

export { SessionComposer };
