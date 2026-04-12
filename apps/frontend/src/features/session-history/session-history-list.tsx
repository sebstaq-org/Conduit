import { Box, Text } from "@/theme";
import { List } from "@/ui";
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
  isFetching: boolean;
  isLoading: boolean;
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

function SessionHistoryList({
  history,
  isError,
  isFetching,
  isLoading,
  title,
}: SessionHistoryListProps): React.JSX.Element {
  return (
    <List>
      {renderStatusText(title)}
      {isLoading && renderStatusText("Loading session")}
      {isError && renderStatusText("Session unavailable")}
      {isFetching && !isLoading && renderStatusText("Refreshing session")}
      {history !== undefined &&
        history.items.length === 0 &&
        renderStatusText("No messages yet")}
      {history?.items.map((item) => renderTranscriptItem(item))}
    </List>
  );
}

export { SessionHistoryList };
