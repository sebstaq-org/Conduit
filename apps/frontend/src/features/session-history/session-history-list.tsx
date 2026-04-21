import { useMemo } from "react";
import { useTheme } from "@shopify/restyle";
import { FlatList } from "react-native";
import { Box, Text } from "@/theme";
import type { Theme } from "@/theme";
import { transcriptItemLabel } from "./session-history-content";
import { SessionHistoryMarkdown } from "./session-history-markdown";
import { useSessionHistoryScrollController } from "./session-history-scroll-controller";
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
  isFetchingOlder: boolean;
  history: SessionHistoryWindow;
  onLoadOlder: () => void;
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

const historyListTestId = "session-history-list";
const historyInitialNumToRender = 24;
const historyWindowSize = 10;
const historyMaxToRenderPerBatch = 12;

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
  return [...history.items].reverse().map((item) => ({
    item,
    kind: "transcript",
    key: `item:${item.id}`,
  }));
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
  paddingTop: number;
  width: "100%";
} {
  const historyListStyle = createHistoryListStyle(theme);
  return {
    alignSelf: historyListStyle.alignSelf,
    maxWidth: historyListStyle.maxWidth,
    paddingBottom: theme.spacing.scrollBottom,
    paddingTop: theme.spacing.scrollBottom,
    width: historyListStyle.width,
  };
}

function historyItemSeparator(theme: Theme): React.JSX.Element {
  return <Box style={{ height: theme.spacing[historyListGap] }} />;
}

function SessionHistoryList({
  isFetchingOlder,
  history,
  onLoadOlder,
  openSessionId,
}: SessionHistoryListProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const rows = useMemo(() => sessionHistoryRows(history), [history]);
  const controller = useSessionHistoryScrollController<SessionHistoryListRow>({
    hasOlder: history.nextCursor !== null,
    isFetchingOlder,
    onLoadOlder,
    openSessionId,
    olderCursor: history.nextCursor,
    revision: history.revision,
  });

  return (
    <FlatList
      accessibilityLabel="Session history"
      contentContainerStyle={createHistoryContentContainerStyle(theme)}
      data={rows}
      initialNumToRender={historyInitialNumToRender}
      inverted
      ItemSeparatorComponent={() => historyItemSeparator(theme)}
      key={openSessionId}
      keyExtractor={(row) => row.key}
      maintainVisibleContentPosition={
        controller.maintainVisibleContentPosition
      }
      maxToRenderPerBatch={historyMaxToRenderPerBatch}
      onContentSizeChange={controller.onContentSizeChange}
      onLayout={controller.onLayout}
      onScroll={controller.onScroll}
      ref={controller.listRef}
      renderItem={({ item }) => renderHistoryRow(item, theme)}
      scrollEventThrottle={controller.scrollEventThrottle}
      showsVerticalScrollIndicator
      style={controller.contentViewportStyle}
      testID={historyListTestId}
      windowSize={historyWindowSize}
    />
  );
}

export { SessionHistoryList };
