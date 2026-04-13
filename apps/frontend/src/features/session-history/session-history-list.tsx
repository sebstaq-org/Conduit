import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { transcriptItemLabel } from "./session-history-content";
import { SessionHistoryMarkdown } from "./session-history-markdown";
import {
  createHistoryListStyle,
  createHistoryUserBubbleStyle,
  createHistoryUserTextStyle,
  historyAgentRowAlignItems,
  historyListGap,
  historyStatusVariant,
  historyUserBubbleBackgroundColor,
  historyUserRowAlignItems,
} from "./session-history.styles";
import type {
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";

interface SessionHistoryListProps {
  history: SessionHistoryWindow | undefined;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
}

function eventLabel(item: TranscriptItem): string {
  if (item.kind !== "event") {
    return "";
  }
  if (item.variant === "tool_call" || item.variant === "tool_call_update") {
    return "Tool call";
  }
  return item.variant;
}

function renderEventItem(item: TranscriptItem): React.JSX.Element | null {
  if (item.kind !== "event") {
    return null;
  }
  return (
    <Text key={item.id} variant={historyStatusVariant}>
      {eventLabel(item)}
    </Text>
  );
}

function renderAgentMessage(item: TranscriptItem): React.JSX.Element | null {
  if (item.kind !== "message") {
    return null;
  }
  return (
    <Box alignItems={historyAgentRowAlignItems} key={item.id}>
      <SessionHistoryMarkdown markdown={transcriptItemLabel(item)} />
    </Box>
  );
}

function renderUserMessage(
  item: TranscriptItem,
  theme: Theme,
): React.JSX.Element | null {
  if (item.kind !== "message") {
    return null;
  }
  return (
    <Box alignItems={historyUserRowAlignItems} key={item.id}>
      <Box
        backgroundColor={historyUserBubbleBackgroundColor}
        style={createHistoryUserBubbleStyle(theme)}
      >
        <Text style={createHistoryUserTextStyle(theme)}>
          {transcriptItemLabel(item)}
        </Text>
      </Box>
    </Box>
  );
}

function renderTranscriptItem(
  item: TranscriptItem,
  theme: Theme,
): React.JSX.Element | null {
  if (item.kind === "event") {
    return renderEventItem(item);
  }
  if (item.kind !== "message") {
    return null;
  }
  if (item.role === "user") {
    return renderUserMessage(item, theme);
  }
  return renderAgentMessage(item);
}

function renderStatusText(text: string, key?: string): React.JSX.Element {
  return (
    <Text key={key} variant={historyStatusVariant}>
      {text}
    </Text>
  );
}

function SessionHistoryList({
  history,
  isError,
  isFetching,
  isLoading,
}: SessionHistoryListProps): React.JSX.Element {
  const theme = useTheme<Theme>();

  return (
    <Box gap={historyListGap} style={createHistoryListStyle(theme)}>
      {isLoading && renderStatusText("Loading session")}
      {isError && renderStatusText("Session unavailable")}
      {isFetching &&
        !isLoading &&
        history === undefined &&
        renderStatusText("Refreshing session")}
      {history !== undefined &&
        history.items.length === 0 &&
        renderStatusText("No messages yet")}
      {history?.items.map((item) => renderTranscriptItem(item, theme))}
    </Box>
  );
}

export { SessionHistoryList };
