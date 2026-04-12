import { useTheme } from "@shopify/restyle";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import remend from "remend";
import type { Theme } from "@/theme";
import { createSessionTranscriptMarkdownStyle } from "./session-transcript.styles";

interface TranscriptMarkdownProps {
  markdown: string;
}

function TranscriptMarkdown({
  markdown,
}: TranscriptMarkdownProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const safeMarkdown = remend(markdown, { linkMode: "text-only" });

  return (
    <EnrichedMarkdownText
      flavor="commonmark"
      markdown={safeMarkdown}
      markdownStyle={createSessionTranscriptMarkdownStyle(theme)}
      md4cFlags={{ latexMath: false }}
      selectable
    />
  );
}

export { TranscriptMarkdown };
