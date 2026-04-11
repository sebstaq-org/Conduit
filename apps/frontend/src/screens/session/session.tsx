import { SessionComposer } from "@/features/session-composer";
import { SessionTranscript } from "@/features/session-transcript";
import { Box } from "@/theme";
import { KeyboardLift } from "@/ui";
import {
  sessionScreenBackgroundColor,
  sessionScreenFlex,
  sessionScreenGap,
  sessionScreenPaddingX,
  sessionScreenPaddingY,
} from "./session.styles";

function SessionScreen(): React.JSX.Element {
  return (
    <KeyboardLift>
      <Box
        backgroundColor={sessionScreenBackgroundColor}
        flex={sessionScreenFlex}
        gap={sessionScreenGap}
        px={sessionScreenPaddingX}
        py={sessionScreenPaddingY}
      >
        <SessionTranscript />
        <SessionComposer />
      </Box>
    </KeyboardLift>
  );
}

export { SessionScreen };
