import { Box } from "@/theme";
import { SessionComposerPreviewControlChip } from "./session-composer-control";
import {
  sessionComposerGap,
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
} from "./session-composer.styles";

interface SessionComposerControlsProps {
  provider?: string | undefined;
}

function renderComposerControl(provider: string): React.JSX.Element {
  return (
    <SessionComposerPreviewControlChip
      control={{ label: "Provider", value: provider }}
      key={provider}
    />
  );
}

function SessionComposerControls({
  provider,
}: SessionComposerControlsProps): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      gap={sessionComposerGap}
    >
      {provider !== undefined && renderComposerControl(provider)}
    </Box>
  );
}

export { SessionComposerControls };
