import { useTheme } from "@shopify/restyle";
import { StreamdownText } from "react-native-streamdown";
import type { Theme } from "@/theme";
import { createSessionTranscriptMarkdownStyle } from "./session-transcript.styles";

interface TranscriptMarkdownProps {
  markdown: string;
}

function TranscriptMarkdown({
  markdown,
}: TranscriptMarkdownProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  return (
    <StreamdownText
      markdown={markdown}
      markdownStyle={createSessionTranscriptMarkdownStyle(theme)}
      md4cFlags={{ latexMath: false }}
      remendConfig={{ linkMode: "text-only" }}
      selectable
    />
  );
}

export { TranscriptMarkdown };
