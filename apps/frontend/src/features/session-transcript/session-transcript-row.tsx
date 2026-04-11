import { Box, Text } from "@/theme";
import {
  sessionTranscriptMetaVariant,
  sessionTranscriptRoleLabel,
  sessionTranscriptRowGap,
  sessionTranscriptTextVariant,
} from "./session-transcript.styles";
import type { SessionTranscriptItem } from "./session-transcript.types";

interface SessionTranscriptRowProps {
  row: SessionTranscriptItem;
}

function SessionTranscriptRow({
  row,
}: SessionTranscriptRowProps): React.JSX.Element | null {
  if (row.kind !== "message") {
    return null;
  }

  return (
    <Box gap={sessionTranscriptRowGap}>
      <Text variant={sessionTranscriptMetaVariant}>
        {sessionTranscriptRoleLabel(row.role)}
      </Text>
      <Text variant={sessionTranscriptTextVariant}>{row.text}</Text>
    </Box>
  );
}

export { SessionTranscriptRow };
