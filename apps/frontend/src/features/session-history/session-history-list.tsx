import { Box, Text } from "@/theme";
import { List, Row } from "@/ui";
import {
  transcriptItemLabel,
  transcriptItemMeta,
} from "./session-history-content";
import { historyStatusVariant } from "./session-history.styles";
import type {
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";

const historyItemBorderColor = "borderSubtle" as const;
const historyItemBorderRadius = "row" as const;
const historyItemGap = "xs" as const;
const historyItemPadding = "sm" as const;
const historyTextVariant = "rowLabel" as const;

interface SessionHistoryListProps {
  history: SessionHistoryWindow | undefined;
  isError: boolean;
  isFetchingOlder: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onLoadOlder: () => void;
  title: string;
}

function renderTranscriptItem(item: TranscriptItem): React.JSX.Element {
  return (
    <Box
      borderColor={historyItemBorderColor}
      borderRadius={historyItemBorderRadius}
      borderWidth={1}
      gap={historyItemGap}
      key={item.id}
      p={historyItemPadding}
    >
      <Text variant={historyStatusVariant}>{transcriptItemMeta(item)}</Text>
      <Text variant={historyTextVariant}>{transcriptItemLabel(item)}</Text>
    </Box>
  );
}

function renderStatusText(text: string): React.JSX.Element {
  return <Text variant={historyStatusVariant}>{text}</Text>;
}

function loadOlderLabel(isFetchingOlder: boolean): string {
  if (isFetchingOlder) {
    return "Loading older messages";
  }
  return "Load older messages";
}

function loadOlderPress(
  isFetchingOlder: boolean,
  onLoadOlder: () => void,
): (() => void) | undefined {
  if (isFetchingOlder) {
    return undefined;
  }
  return onLoadOlder;
}

function SessionHistoryList({
  history,
  isError,
  isFetchingOlder,
  isFetching,
  isLoading,
  onLoadOlder,
  title,
}: SessionHistoryListProps): React.JSX.Element {
  return (
    <List>
      {renderStatusText(title)}
      {isLoading && renderStatusText("Loading session")}
      {isError && renderStatusText("Session unavailable")}
      {isFetching && !isLoading && renderStatusText("Refreshing session")}
      {history?.nextCursor !== null && history?.nextCursor !== undefined && (
        <Row
          label={loadOlderLabel(isFetchingOlder)}
          muted={isFetchingOlder}
          onPress={loadOlderPress(isFetchingOlder, onLoadOlder)}
        />
      )}
      {history !== undefined &&
        history.items.length === 0 &&
        renderStatusText("No messages yet")}
      {history?.items.map((item) => renderTranscriptItem(item))}
    </List>
  );
}

export { SessionHistoryList };
