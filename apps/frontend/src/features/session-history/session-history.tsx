import { skipToken } from "@reduxjs/toolkit/query";
import { useCallback, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useSelector } from "react-redux";
import { selectActiveSession, useReadSessionHistoryQuery } from "@/app-state";
import { Box, Text } from "@/theme";
import { ScrollArea } from "@/ui";
import { SessionHistoryList } from "./session-history-list";
import { useSessionHistoryAutoScroll } from "./session-history-auto-scroll";
import {
  activeOlderHistoryFor,
  currentOlderPageFor,
  historyViewState,
  nextOlderHistoryState,
} from "./session-history-window";
import type { ActiveSession } from "@/app-state";
import type {
  ScrollAreaContentSize,
  ScrollAreaHandle,
  ScrollAreaMetrics,
} from "@/ui";
import type { SessionHistoryWindow } from "@conduit/session-client";
import type { OlderHistoryState } from "./session-history-window";

interface SessionHistoryQueryArg {
  cursor?: string | null;
  limit?: number;
  openSessionId: string;
}

interface LoadOlderContext {
  activeSession: ActiveSession | null;
  data: SessionHistoryWindow | undefined;
  olderHistory: OlderHistoryState | null;
  olderPage: ReturnType<typeof currentOlderPageFor>;
  setOlderHistory: Dispatch<SetStateAction<OlderHistoryState | null>>;
}

interface HistoryContentProps {
  history: SessionHistoryWindow | undefined;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onContentSizeChange: (size: ScrollAreaContentSize) => void;
  onMetricsChange: (metrics: ScrollAreaMetrics) => void;
  scrollAreaRef: RefObject<ScrollAreaHandle | null>;
}

interface OlderHistoryView {
  historyState: ReturnType<typeof historyViewState>;
  isFetchingOlder: boolean;
  isOlderError: boolean;
}

type OptionalSessionHistoryQueryArg = SessionHistoryQueryArg | typeof skipToken;
const historyStatusVariant = "rowLabelMuted" as const;

function sessionHistoryQueryArg(
  activeSession: ActiveSession | null,
): OptionalSessionHistoryQueryArg {
  if (activeSession === null) {
    return skipToken;
  }
  return {
    openSessionId: activeSession.openSessionId,
  };
}

function olderHistoryQueryArg(
  activeSession: ActiveSession | null,
  olderHistory: OlderHistoryState | null,
): OptionalSessionHistoryQueryArg {
  if (
    activeSession === null ||
    olderHistory === null ||
    olderHistory.cursor === null
  ) {
    return skipToken;
  }
  return {
    cursor: olderHistory.cursor,
    limit: 40,
    openSessionId: activeSession.openSessionId,
  };
}

function loadOlderWindow({
  activeSession,
  data,
  olderHistory,
  olderPage,
  setOlderHistory,
}: LoadOlderContext): void {
  setOlderHistory(
    nextOlderHistoryState({
      data,
      olderHistory,
      olderPage,
      openSessionId: activeSession?.openSessionId ?? null,
    }),
  );
}

function renderNoActiveSession(): React.JSX.Element {
  return (
    <Box flex={1}>
      <Text variant={historyStatusVariant}>Select a session</Text>
    </Box>
  );
}

function renderHistoryContent({
  history,
  isError,
  isFetching,
  isLoading,
  onContentSizeChange,
  onMetricsChange,
  scrollAreaRef,
}: HistoryContentProps): React.JSX.Element {
  return (
    <Box flex={1}>
      <ScrollArea
        onContentSizeChange={onContentSizeChange}
        onMetricsChange={onMetricsChange}
        ref={scrollAreaRef}
      >
        <SessionHistoryList
          history={history}
          isError={isError}
          isFetching={isFetching}
          isLoading={isLoading}
        />
      </ScrollArea>
    </Box>
  );
}

function useOlderHistoryView(
  activeSession: ActiveSession | null,
  data: SessionHistoryWindow | undefined,
  olderHistory: OlderHistoryState | null,
): OlderHistoryView {
  const activeOlderHistory = activeOlderHistoryFor(olderHistory, data);
  const olderPageQuery = useReadSessionHistoryQuery(
    olderHistoryQueryArg(activeSession, activeOlderHistory),
  );
  const olderPage = currentOlderPageFor(
    activeOlderHistory,
    activeOlderHistory?.cursor ?? null,
    olderPageQuery.currentData,
  );
  return {
    historyState: historyViewState(data, activeOlderHistory, olderPage),
    isFetchingOlder: olderPageQuery.isFetching,
    isOlderError: olderPageQuery.isError,
  };
}

function SessionHistory(): React.JSX.Element {
  const activeSession = useSelector(selectActiveSession);
  const activeOpenSessionId = activeSession?.openSessionId ?? null;
  const [olderHistory, setOlderHistory] = useState<OlderHistoryState | null>(
    null,
  );
  const { data, isError, isFetching, isLoading } = useReadSessionHistoryQuery(
    sessionHistoryQueryArg(activeSession),
  );
  const { historyState, isFetchingOlder, isOlderError } = useOlderHistoryView(
    activeSession,
    data,
    olderHistory,
  );
  const loadOlder = useCallback(() => {
    loadOlderWindow({
      activeSession,
      data,
      olderHistory: historyState.activeOlderHistory,
      olderPage: historyState.activeOlderPage,
      setOlderHistory,
    });
  }, [activeSession, data, historyState]);
  const { onContentSizeChange, onMetricsChange, scrollAreaRef } =
    useSessionHistoryAutoScroll({
      activeOpenSessionId,
      isFetchingOlder,
      loadOlder,
      nextOlderCursor: historyState.history?.nextCursor ?? null,
    });

  if (activeSession === null) {
    return renderNoActiveSession();
  }

  return renderHistoryContent({
    history: historyState.history,
    isError: isError || isOlderError,
    isFetching,
    isLoading,
    onContentSizeChange,
    onMetricsChange,
    scrollAreaRef,
  });
}

export { SessionHistory };
