import { Box, Text } from "@/theme";
import {
  sessionScreenAlignItems,
  sessionScreenBackgroundColor,
  sessionScreenFlex,
  sessionScreenJustifyContent,
  sessionScreenPaddingX,
  sessionScreenPlaceholderVariant,
} from "./session.styles";

function SessionScreen(): React.JSX.Element {
  return (
    <Box
      alignItems={sessionScreenAlignItems}
      backgroundColor={sessionScreenBackgroundColor}
      flex={sessionScreenFlex}
      justifyContent={sessionScreenJustifyContent}
      px={sessionScreenPaddingX}
    >
      <Text variant={sessionScreenPlaceholderVariant}>No session selected</Text>
    </Box>
  );
}

export { SessionScreen };
