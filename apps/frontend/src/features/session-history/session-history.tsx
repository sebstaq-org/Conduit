import { skipToken } from "@reduxjs/toolkit/query";
import { useCallback, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useSelector } from "react-redux";
import { selectActiveSession, useReadSessionHistoryQuery } from "@/app-state";
import { Box, Text } from "@/theme";
import { ScrollArea } from "@/ui";
import { historyStatusVariant } from "./session-history.styles";
import { SessionHistoryList } from "./session-history-list";
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
  isFetchingOlder: boolean;
  isLoading: boolean;
  onContentSizeChange: (size: ScrollAreaContentSize) => void;
  onLoadOlder: () => void;
  onMetricsChange: (metrics: ScrollAreaMetrics) => void;
  scrollAreaRef: RefObject<ScrollAreaHandle | null>;
}

interface OlderHistoryView {
  historyState: ReturnType<typeof historyViewState>;
  isFetchingOlder: boolean;
  isOlderError: boolean;
}

interface SessionHistoryAutoScroll {
  onContentSizeChange: (size: ScrollAreaContentSize) => void;
  onMetricsChange: (metrics: ScrollAreaMetrics) => void;
  scrollAreaRef: RefObject<ScrollAreaHandle | null>;
}

interface SessionTrackingRefs {
  isNearBottomRef: RefObject<boolean>;
  shouldSnapToBottomRef: RefObject<boolean>;
  trackedSessionIdRef: RefObject<string | null>;
}

type OptionalSessionHistoryQueryArg = SessionHistoryQueryArg | typeof skipToken;
const historyAutoScrollThreshold = 48;

function nearHistoryBottom(metrics: ScrollAreaMetrics): boolean {
  return metrics.distanceFromBottom <= historyAutoScrollThreshold;
}

function syncTrackedSession(
  activeOpenSessionId: string | null,
  refs: SessionTrackingRefs,
): void {
  if (refs.trackedSessionIdRef.current === activeOpenSessionId) {
    return;
  }
  refs.trackedSessionIdRef.current = activeOpenSessionId;
  refs.shouldSnapToBottomRef.current = activeOpenSessionId !== null;
  refs.isNearBottomRef.current = true;
}

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
  isFetchingOlder,
  isLoading,
  onContentSizeChange,
  onLoadOlder,
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
          isFetchingOlder={isFetchingOlder}
          isLoading={isLoading}
          onLoadOlder={onLoadOlder}
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

function useSessionHistoryAutoScroll(
  activeOpenSessionId: string | null,
): SessionHistoryAutoScroll {
  const scrollAreaRef = useRef<ScrollAreaHandle | null>(null);
  const isNearBottomRef = useRef(true);
  const shouldSnapToBottomRef = useRef(activeOpenSessionId !== null);
  const trackedSessionIdRef = useRef(activeOpenSessionId);
  syncTrackedSession(activeOpenSessionId, {
    isNearBottomRef,
    shouldSnapToBottomRef,
    trackedSessionIdRef,
  });

  const onMetricsChange = useCallback((metrics: ScrollAreaMetrics): void => {
    isNearBottomRef.current = nearHistoryBottom(metrics);
  }, []);
  const onContentSizeChange = useCallback(
    (_size: ScrollAreaContentSize): void => {
      if (shouldSnapToBottomRef.current) {
        scrollAreaRef.current?.scrollToEnd({ animated: false });
        shouldSnapToBottomRef.current = false;
        return;
      }
      if (isNearBottomRef.current) {
        scrollAreaRef.current?.scrollToEnd({ animated: true });
      }
    },
    [],
  );

  return {
    onContentSizeChange,
    onMetricsChange,
    scrollAreaRef,
  };
}

function SessionHistory(): React.JSX.Element {
  const activeSession = useSelector(selectActiveSession);
  const activeOpenSessionId = activeSession?.openSessionId ?? null;
  const [olderHistory, setOlderHistory] = useState<OlderHistoryState | null>(
    null,
  );
  const { onContentSizeChange, onMetricsChange, scrollAreaRef } =
    useSessionHistoryAutoScroll(activeOpenSessionId);
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

  if (activeSession === null) {
    return renderNoActiveSession();
  }

  return renderHistoryContent({
    history: historyState.history,
    isError: isError || isOlderError,
    isFetching,
    isFetchingOlder,
    isLoading,
    onContentSizeChange,
    onLoadOlder: loadOlder,
    onMetricsChange,
    scrollAreaRef,
  });
}

export { SessionHistory };
