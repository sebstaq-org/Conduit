import { Box } from "@/theme";
import { IconButton } from "@/ui";
import type { ProviderId } from "@conduit/session-client";
import type { SessionConfigOption } from "@conduit/session-client";
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
  configOptions: SessionConfigOption[] | null;
  isDraft: boolean;
  isUpdatingConfig: boolean;
  onConfigOptionSelect: (configId: string, value: string) => void;
  onSend: () => void;
  onProviderSelect: (provider: ProviderId) => void;
  provider: ProviderId | null;
}

function SessionComposerActionRow({
  canSend,
  configOptions,
  isDraft,
  isUpdatingConfig,
  onConfigOptionSelect,
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
        configOptions={configOptions}
        isDraft={isDraft}
        isUpdatingConfig={isUpdatingConfig}
        onConfigOptionSelect={onConfigOptionSelect}
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
