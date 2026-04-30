import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import {
  createHistoryToolCallMetaStyle,
  createHistoryToolCallPreviewStyle,
  createHistoryToolCallStyle,
  createHistoryToolCallTitleStyle,
} from "./session-history.styles";
import type { SessionHistoryToolCallProjection } from "./session-history-tool-call-projection";

interface SessionHistoryToolCallRowProps {
  item: SessionHistoryToolCallProjection;
}

function optionalParts(item: SessionHistoryToolCallProjection): string[] {
  const parts: string[] = [];
  if (item.truncated) {
    parts.push("truncated");
  }
  if (item.locationCount > 0) {
    parts.push(`${item.locationCount} locations`);
  }
  if (item.updateCount > 1) {
    parts.push(`${item.updateCount} updates`);
  }
  return parts;
}

function toolCallMeta(item: SessionHistoryToolCallProjection): string {
  return [item.kindLabel, item.statusLabel, ...optionalParts(item)].join(" · ");
}

function renderSummary(
  item: SessionHistoryToolCallProjection,
  theme: Theme,
): React.JSX.Element | null {
  if (item.summary === null) {
    return null;
  }
  return (
    <Text numberOfLines={2} style={createHistoryToolCallMetaStyle(theme)}>
      {item.summary}
    </Text>
  );
}

function renderPreview(
  item: SessionHistoryToolCallProjection,
  theme: Theme,
): React.JSX.Element | null {
  if (item.preview === null) {
    return null;
  }
  return (
    <Text
      numberOfLines={8}
      style={createHistoryToolCallPreviewStyle(theme)}
      testID="session-history-tool-call-preview"
    >
      {item.preview}
    </Text>
  );
}

function SessionHistoryToolCallRow({
  item,
}: SessionHistoryToolCallRowProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  return (
    <Box
      style={createHistoryToolCallStyle(theme)}
      testID="session-history-tool-call-row"
    >
      <Text
        numberOfLines={2}
        style={createHistoryToolCallTitleStyle(theme)}
        testID="session-history-tool-call-title"
      >
        {item.title}
      </Text>
      {renderSummary(item, theme)}
      <Text
        numberOfLines={1}
        style={createHistoryToolCallMetaStyle(theme)}
        testID="session-history-tool-call-meta"
      >
        {toolCallMeta(item)}
      </Text>
      {renderPreview(item, theme)}
    </Box>
  );
}

export { SessionHistoryToolCallRow };
