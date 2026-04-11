import { SessionTranscript } from "@/features/session-transcript";
import { Box } from "@/theme";
import {
  sessionScreenBackgroundColor,
  sessionScreenFlex,
  sessionScreenPaddingX,
  sessionScreenPaddingY,
} from "./session.styles";

function SessionScreen(): React.JSX.Element {
  return (
    <Box
      backgroundColor={sessionScreenBackgroundColor}
      flex={sessionScreenFlex}
      px={sessionScreenPaddingX}
      py={sessionScreenPaddingY}
    >
      <SessionTranscript />
    </Box>
  );
}

export { SessionScreen };
