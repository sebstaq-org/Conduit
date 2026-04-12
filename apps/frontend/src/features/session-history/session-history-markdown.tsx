import { useTheme } from "@shopify/restyle";
import { StreamdownText } from "react-native-streamdown";
import type { Theme } from "@/theme";
import { createHistoryAgentMarkdownStyle } from "./session-history.styles";

interface SessionHistoryMarkdownProps {
  markdown: string;
}

function SessionHistoryMarkdown({
  markdown,
}: SessionHistoryMarkdownProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <StreamdownText
      markdown={markdown}
      markdownStyle={createHistoryAgentMarkdownStyle(theme)}
      md4cFlags={{ latexMath: false }}
      remendConfig={{ linkMode: "text-only" }}
      selectable
    />
  );
}

export { SessionHistoryMarkdown };
