import { skipToken } from "@reduxjs/toolkit/query";
import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSelector } from "react-redux";
import { selectActiveSession, useReadSessionHistoryQuery } from "@/app-state";
import { Box, Text } from "@/theme";
import { ScrollArea } from "@/ui";
import { historyStatusVariant } from "./session-history.styles";
import { SessionHistoryList } from "./session-history-list";
import type { ActiveSession } from "@/app-state";
import type { SessionHistoryWindow } from "@conduit/session-client";

interface SessionHistoryQueryArg {
  cursor?: string | null;
  limit?: number;
  openSessionId: string;
}

interface OlderHistoryState {
  cursor: string | null;
  openSessionId: string;
  pages: SessionHistoryWindow[];
  revision: number;
}

interface LoadOlderContext {
  activeSession: ActiveSession | null;
  data: SessionHistoryWindow | undefined;
  olderHistory: OlderHistoryState | null;
  olderPage: SessionHistoryWindow | undefined;
  setOlderHistory: Dispatch<SetStateAction<OlderHistoryState | null>>;
}

interface HistoryContentProps {
  activeSession: ActiveSession;
  history: SessionHistoryWindow | undefined;
  isError: boolean;
  isFetching: boolean;
  isFetchingOlder: boolean;
  isLoading: boolean;
  onLoadOlder: () => void;
}

interface HistoryViewState {
  activeOlderHistory: OlderHistoryState | null;
  activeOlderPage: SessionHistoryWindow | undefined;
  history: SessionHistoryWindow | undefined;
}

type OptionalSessionHistoryQueryArg = SessionHistoryQueryArg | typeof skipToken;

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

function activeOlderHistoryFor(
  olderHistory: OlderHistoryState | null,
  data: SessionHistoryWindow | undefined,
): OlderHistoryState | null {
  if (
    olderHistory !== null &&
    data !== undefined &&
    olderHistory.openSessionId === data.openSessionId &&
    olderHistory.revision === data.revision
  ) {
    return olderHistory;
  }
  return null;
}

function activeOlderPageFor(
  olderPage: SessionHistoryWindow | undefined,
  data: SessionHistoryWindow | undefined,
): SessionHistoryWindow | undefined {
  if (
    olderPage !== undefined &&
    data !== undefined &&
    olderPage.openSessionId === data.openSessionId &&
    olderPage.revision === data.revision
  ) {
    return olderPage;
  }
  return undefined;
}

function nextCursorFor(
  data: SessionHistoryWindow,
  olderHistory: OlderHistoryState | null,
  olderPage: SessionHistoryWindow | undefined,
): string | null {
  if (olderHistory === null) {
    return data.nextCursor;
  }
  if (olderPage !== undefined) {
    return olderPage.nextCursor;
  }
  return olderHistory.cursor;
}

function mergeHistory(
  data: SessionHistoryWindow | undefined,
  olderHistory: OlderHistoryState | null,
  olderPage: SessionHistoryWindow | undefined,
): SessionHistoryWindow | undefined {
  if (data === undefined) {
    return undefined;
  }
  const pages = [...(olderHistory?.pages ?? [])];
  if (olderPage !== undefined) {
    pages.push(olderPage);
  }
  return {
    items: [...pages.flatMap((page) => page.items), ...data.items],
    nextCursor: nextCursorFor(data, olderHistory, olderPage),
    openSessionId: data.openSessionId,
    revision: data.revision,
  };
}

function historyViewState(
  data: SessionHistoryWindow | undefined,
  olderHistory: OlderHistoryState | null,
  olderPage: SessionHistoryWindow | undefined,
): HistoryViewState {
  const activeOlderHistory = activeOlderHistoryFor(olderHistory, data);
  const activeOlderPage = activeOlderPageFor(olderPage, data);
  return {
    activeOlderHistory,
    activeOlderPage,
    history: mergeHistory(data, activeOlderHistory, activeOlderPage),
  };
}

function loadOlderWindow({
  activeSession,
  data,
  olderHistory,
  olderPage,
  setOlderHistory,
}: LoadOlderContext): void {
  if (activeSession === null || data === undefined) {
    return;
  }
  if (olderHistory === null) {
    if (data.nextCursor === null) {
      return;
    }
    setOlderHistory({
      cursor: data.nextCursor,
      openSessionId: data.openSessionId,
      pages: [],
      revision: data.revision,
    });
    return;
  }
  if (olderPage === undefined) {
    return;
  }
  setOlderHistory({
    cursor: olderPage.nextCursor,
    openSessionId: olderPage.openSessionId,
    pages: [...olderHistory.pages, olderPage],
    revision: olderPage.revision,
  });
}

function renderNoActiveSession(): React.JSX.Element {
  return (
    <Box flex={1}>
      <Text variant={historyStatusVariant}>Select a session</Text>
    </Box>
  );
}

function renderHistoryContent({
  activeSession,
  history,
  isError,
  isFetching,
  isFetchingOlder,
  isLoading,
  onLoadOlder,
}: HistoryContentProps): React.JSX.Element {
  return (
    <Box flex={1}>
      <ScrollArea>
        <SessionHistoryList
          history={history}
          isError={isError}
          isFetching={isFetching}
          isFetchingOlder={isFetchingOlder}
          isLoading={isLoading}
          onLoadOlder={onLoadOlder}
          title={activeSession.title ?? activeSession.cwd}
        />
      </ScrollArea>
    </Box>
  );
}

function SessionHistory(): React.JSX.Element {
  const activeSession = useSelector(selectActiveSession);
  const [olderHistory, setOlderHistory] = useState<OlderHistoryState | null>(
    null,
  );
  const { data, isError, isFetching, isLoading } = useReadSessionHistoryQuery(
    sessionHistoryQueryArg(activeSession),
  );
  const activeOlderHistory = activeOlderHistoryFor(olderHistory, data);
  const olderPageQuery = useReadSessionHistoryQuery(
    olderHistoryQueryArg(activeSession, activeOlderHistory),
  );
  const historyState = historyViewState(
    data,
    activeOlderHistory,
    olderPageQuery.data,
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
    activeSession,
    history: historyState.history,
    isError: isError || olderPageQuery.isError,
    isFetching,
    isFetchingOlder: olderPageQuery.isFetching,
    isLoading,
    onLoadOlder: loadOlder,
  });
}

export { SessionHistory };
