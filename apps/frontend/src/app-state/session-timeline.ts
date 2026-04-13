import { skipToken } from "@reduxjs/toolkit/query";
import { useCallback } from "react";
import {
  useLoadOlderSessionTimelineMutation,
  useReadSessionTimelineQuery,
} from "./api-hooks";
import type { SessionHistoryWindow } from "@conduit/session-client";

interface SessionTimelineView {
  exhausted: boolean;
  history: SessionHistoryWindow | undefined;
  isError: boolean;
  isFetching: boolean;
  isFetchingOlder: boolean;
  isLoading: boolean;
  isOlderError: boolean;
  loadOlderIfNeeded: () => void;
}

function useSessionTimeline(openSessionId: string | null): SessionTimelineView {
  let timelineQueryArg: typeof skipToken | { openSessionId: string } =
    skipToken;
  if (openSessionId !== null) {
    timelineQueryArg = { openSessionId };
  }
  const timelineQuery = useReadSessionTimelineQuery(timelineQueryArg);
  const [loadOlder] = useLoadOlderSessionTimelineMutation();

  const loadOlderIfNeeded = useCallback((): void => {
    if (openSessionId === null || timelineQuery.data === undefined) {
      return;
    }
    if (timelineQuery.data.pagination.isFetchingOlder) {
      return;
    }
    const cursor = timelineQuery.data.history.nextCursor;
    if (cursor === null) {
      return;
    }
    void loadOlder({
      cursor,
      openSessionId,
    });
  }, [loadOlder, openSessionId, timelineQuery.data]);

  return {
    exhausted: timelineQuery.data?.pagination.exhausted ?? false,
    history: timelineQuery.data?.history,
    isError: timelineQuery.isError,
    isFetching: timelineQuery.isFetching,
    isFetchingOlder: timelineQuery.data?.pagination.isFetchingOlder ?? false,
    isLoading: timelineQuery.isLoading,
    isOlderError: timelineQuery.data?.pagination.isOlderError ?? false,
    loadOlderIfNeeded,
  };
}

export { useSessionTimeline };
