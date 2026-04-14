import { Box } from "@/theme";
import { IconButton } from "@/ui";
import type { ProviderId } from "@conduit/session-client";
import { SessionComposerControls } from "./session-composer-controls";
import {
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
  sessionComposerRowJustifyContent,
  sessionComposerSendAccessibilityLabel,
  sessionComposerSendIcon,
} from "./session-composer.styles";

interface SessionComposerActionRowProps {
  canSend: boolean;
  isDraft: boolean;
  onSend: () => void;
  onProviderSelect: (provider: ProviderId) => void;
  provider: ProviderId | null;
}

function SessionComposerActionRow({
  canSend,
  isDraft,
  onSend,
  onProviderSelect,
  provider,
}: SessionComposerActionRowProps): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      justifyContent={sessionComposerRowJustifyContent}
    >
      <SessionComposerControls
        isDraft={isDraft}
        onProviderSelect={onProviderSelect}
        provider={provider}
      />
      <IconButton
        accessibilityLabel={sessionComposerSendAccessibilityLabel}
        appearance="filled"
        disabled={!canSend}
        icon={sessionComposerSendIcon}
        onPress={onSend}
      />
    </Box>
  );
}

export { SessionComposerActionRow };
