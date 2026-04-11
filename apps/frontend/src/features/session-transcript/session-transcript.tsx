import { Box } from "@/theme";
import { ScrollArea } from "@/ui";
import { mockSessionTranscript } from "./session-transcript.fixtures";
import { sessionTranscriptGap } from "./session-transcript.styles";
import { SessionTranscriptRow } from "./session-transcript-row";

function SessionTranscript(): React.JSX.Element {
  return (
    <ScrollArea>
      <Box gap={sessionTranscriptGap}>
        {mockSessionTranscript.rows.map((row) => (
          <SessionTranscriptRow key={row.id} row={row} />
        ))}
      </Box>
    </ScrollArea>
  );
}

export { SessionTranscript };
