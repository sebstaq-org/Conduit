import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { VirtualList } from "@/ui";
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
  history: SessionHistoryWindow;
  onStartReached: () => void;
  openSessionId: string;
}

type SessionHistoryListRow =
  | {
      kind: "status";
      key: string;
      label: string;
    }
  | {
      item: TranscriptItem;
      kind: "transcript";
      key: string;
    };

const historyViewportStyle = { flex: 1, minHeight: 0 } as const;
const historyStartReachedThreshold = 2;
const historyVisibleContentPosition = {
  animateAutoScrollToBottom: false,
  autoscrollToBottomThreshold: 0.2,
  autoscrollToTopThreshold: 0.2,
  startRenderingFromBottom: true,
} as const;

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
  return <Text variant={historyStatusVariant}>{eventLabel(item)}</Text>;
}

function renderAgentMessage(item: TranscriptItem): React.JSX.Element | null {
  if (item.kind !== "message") {
    return null;
  }
  return (
    <Box alignItems={historyAgentRowAlignItems}>
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
    <Box alignItems={historyUserRowAlignItems}>
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

function sessionHistoryRows(
  history: SessionHistoryWindow,
): SessionHistoryListRow[] {
  if (history.items.length === 0) {
    return [{ kind: "status", key: "status:empty", label: "No messages yet" }];
  }
  return history.items.map((item) => ({
    item,
    kind: "transcript",
    key: `item:${item.id}`,
  }));
}

function rowType(row: SessionHistoryListRow): string {
  if (row.kind === "status") {
    return "status";
  }
  if (row.item.kind === "event") {
    return "event";
  }
  if (row.item.role === "user") {
    return "user";
  }
  return "agent";
}

function renderHistoryRow(
  row: SessionHistoryListRow,
  theme: Theme,
): React.JSX.Element | null {
  if (row.kind === "status") {
    return <Text variant={historyStatusVariant}>{row.label}</Text>;
  }
  return renderTranscriptItem(row.item, theme);
}

function createHistoryContentContainerStyle(theme: Theme): {
  alignSelf: "center";
  maxWidth: number;
  paddingBottom: number;
  width: "100%";
} {
  const historyListStyle = createHistoryListStyle(theme);
  return {
    alignSelf: historyListStyle.alignSelf,
    maxWidth: historyListStyle.maxWidth,
    paddingBottom: theme.spacing.scrollBottom,
    width: historyListStyle.width,
  };
}

function historyItemSeparator(theme: Theme): React.JSX.Element {
  return <Box style={{ height: theme.spacing[historyListGap] }} />;
}

function SessionHistoryList({
  history,
  onStartReached,
  openSessionId,
}: SessionHistoryListProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const rows = sessionHistoryRows(history);

  return (
    <VirtualList
      contentContainerStyle={createHistoryContentContainerStyle(theme)}
      data={rows}
      getItemType={rowType}
      ItemSeparatorComponent={() => historyItemSeparator(theme)}
      keyExtractor={(row) => row.key}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="never"
      listKey={openSessionId}
      maintainVisibleContentPosition={historyVisibleContentPosition}
      onStartReached={onStartReached}
      onStartReachedThreshold={historyStartReachedThreshold}
      renderItem={({ item }) => renderHistoryRow(item, theme)}
      showsVerticalScrollIndicator
      style={historyViewportStyle}
    />
  );
}

export { SessionHistoryList };
