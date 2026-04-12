import { Box, Text } from "@/theme";
import {
  sessionTranscriptMetaVariant,
  sessionTranscriptRoleLabel,
  sessionTranscriptRowGap,
  sessionTranscriptTextVariant,
} from "./session-transcript.styles";
import { TranscriptMarkdown } from "./transcript-markdown";
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

  let message = <TranscriptMarkdown markdown={row.text} />;

  if (row.role === "user") {
    message = <Text variant={sessionTranscriptTextVariant}>{row.text}</Text>;
  }

  return (
    <Box gap={sessionTranscriptRowGap}>
      <Text variant={sessionTranscriptMetaVariant}>
        {sessionTranscriptRoleLabel(row.role)}
      </Text>
      {message}
    </Box>
  );
}

export { SessionTranscriptRow };
