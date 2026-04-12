import { Box } from "@/theme";
import { SessionComposerPreviewControlChip } from "./session-composer-control";
import {
  sessionComposerGap,
  sessionComposerPreviewControls,
  sessionComposerRowAlignItems,
  sessionComposerRowFlexDirection,
} from "./session-composer.styles";

function renderComposerControl(
  control: (typeof sessionComposerPreviewControls)[number],
): React.JSX.Element {
  return (
    <SessionComposerPreviewControlChip control={control} key={control.label} />
  );
}

function SessionComposerControls(): React.JSX.Element {
  return (
    <Box
      alignItems={sessionComposerRowAlignItems}
      flexDirection={sessionComposerRowFlexDirection}
      gap={sessionComposerGap}
    >
      {sessionComposerPreviewControls.map((control) =>
        renderComposerControl(control),
      )}
    </Box>
  );
}

export { SessionComposerControls };
