import { useRef } from "react";
import { useTheme } from "@shopify/restyle";
import { Box, Text } from "@/theme";
import { VirtualList } from "@/ui";
import type { FlashListProps, FlashListRef } from "@shopify/flash-list";
import {
  SessionHistoryMarkdown,
  transcriptItemLabel,
} from "./session-history-rendering";
import { createHistoryContentContainerStyle } from "./session-history-list-layout";
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
import {
  SessionHistoryToolCallRow,
  isSessionHistoryToolCallProjection,
  projectSessionHistoryItems,
} from "./session-history-tool-call";
import type { SessionHistoryProjectedItem } from "./session-history-tool-call";
import type {
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";

type HistoryTheme = Parameters<typeof createHistoryListStyle>[0];

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
      item: SessionHistoryProjectedItem;
      kind: "transcript";
      key: string;
    };

const historyViewportStyle = { flex: 1, minHeight: 0 } as const;
const historyStartReachedThreshold = 2;
const historyFollowEndThreshold = 240;
const historyVisibleContentPosition = {
  animateAutoScrollToBottom: true,
  autoscrollToBottomThreshold: 1,
  autoscrollToTopThreshold: 0.2,
  startRenderingFromBottom: true,
} as const;

function eventLabel(item: TranscriptItem): string {
  if (item.kind !== "event") {
    return "";
  }
  if (item.variant === "turn_error") {
    return transcriptItemLabel(item);
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
  theme: HistoryTheme,
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
  item: SessionHistoryProjectedItem,
  theme: HistoryTheme,
): React.JSX.Element | null {
  if (isSessionHistoryToolCallProjection(item)) {
    return <SessionHistoryToolCallRow item={item} />;
  }
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
  return projectSessionHistoryItems(history.items).map((item) => ({
    item,
    kind: "transcript",
    key: `item:${item.id}`,
  }));
}

function rowType(row: SessionHistoryListRow): string {
  if (row.kind === "status") {
    return "status";
  }
  if (isSessionHistoryToolCallProjection(row.item)) {
    return "tool-call";
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
  theme: HistoryTheme,
): React.JSX.Element | null {
  if (row.kind === "status") {
    return <Text variant={historyStatusVariant}>{row.label}</Text>;
  }
  return renderTranscriptItem(row.item, theme);
}

function createHistoryListContentContainerStyle(theme: HistoryTheme): {
  alignSelf: "center";
  maxWidth: number;
  paddingBottom: number;
  width: "100%";
} {
  const historyListStyle = createHistoryListStyle(theme);
  return createHistoryContentContainerStyle({
    maxWidth: historyListStyle.maxWidth,
    theme,
  });
}

function historyItemSeparator(theme: HistoryTheme): React.JSX.Element {
  return <Box style={{ height: theme.spacing[historyListGap] }} />;
}

interface HistoryFollowEndHandlers {
  handleContentSizeChange: NonNullable<
    FlashListProps<SessionHistoryListRow>["onContentSizeChange"]
  >;
  handleLoad: NonNullable<FlashListProps<SessionHistoryListRow>["onLoad"]>;
  handleScroll: NonNullable<FlashListProps<SessionHistoryListRow>["onScroll"]>;
  listRef: React.RefObject<FlashListRef<SessionHistoryListRow> | null>;
}

function useHistoryFollowEnd(): HistoryFollowEndHandlers {
  const listRef = useRef<FlashListRef<SessionHistoryListRow>>(null);
  const followEndRef = useRef(true);

  return {
    handleContentSizeChange: () => {
      if (followEndRef.current) {
        listRef.current?.scrollToEnd({ animated: false });
      }
    },
    handleLoad: () => {
      listRef.current?.scrollToEnd({ animated: false });
    },
    handleScroll: (event) => {
      const viewportHeight = event.nativeEvent.layoutMeasurement.height;
      const offsetY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const distanceFromEnd = contentHeight - viewportHeight - offsetY;
      followEndRef.current = distanceFromEnd <= historyFollowEndThreshold;
    },
    listRef,
  };
}

function SessionHistoryList({
  history,
  onStartReached,
  openSessionId,
}: SessionHistoryListProps): React.JSX.Element {
  const theme = useTheme<HistoryTheme>();
  const rows = sessionHistoryRows(history);
  const followEnd = useHistoryFollowEnd();

  return (
    <VirtualList
      contentContainerStyle={createHistoryListContentContainerStyle(theme)}
      data={rows}
      getItemType={rowType}
      ItemSeparatorComponent={() => historyItemSeparator(theme)}
      keyExtractor={(row) => row.key}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="never"
      listKey={openSessionId}
      listRef={followEnd.listRef}
      maintainVisibleContentPosition={historyVisibleContentPosition}
      onContentSizeChange={followEnd.handleContentSizeChange}
      onLoad={followEnd.handleLoad}
      onScroll={followEnd.handleScroll}
      onStartReached={onStartReached}
      onStartReachedThreshold={historyStartReachedThreshold}
      renderItem={({ item }) => renderHistoryRow(item, theme)}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator
      style={historyViewportStyle}
    />
  );
}

export { SessionHistoryList };
