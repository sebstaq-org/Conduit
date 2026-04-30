import { skipToken } from "@reduxjs/toolkit/query";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import {
  useLoadOlderSessionTimelineMutation,
  useReadSessionTimelineQuery,
} from "./api-hooks";
import type { SessionHistoryWindow } from "@conduit/session-client";
import { withPendingPromptMessages } from "./session-pending-prompts";
import type { PendingPromptMessage } from "./session-pending-prompts";
import type { RootState } from "./store";

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

const emptyPendingPrompts: PendingPromptMessage[] = [];

function selectPendingPromptsForOpenSession(
  state: Pick<RootState, "sessionPendingPrompts">,
  openSessionId: string | null,
): PendingPromptMessage[] {
  if (openSessionId === null) {
    return emptyPendingPrompts;
  }
  return (
    state.sessionPendingPrompts.byOpenSessionId[openSessionId] ??
    emptyPendingPrompts
  );
}

function timelineHistoryWithPending(
  history: SessionHistoryWindow | undefined,
  pendingPrompts: Parameters<typeof withPendingPromptMessages>[1],
): SessionHistoryWindow | undefined {
  if (history === undefined) {
    return undefined;
  }
  return withPendingPromptMessages(history, pendingPrompts);
}

function useSessionTimeline(openSessionId: string | null): SessionTimelineView {
  let timelineQueryArg: typeof skipToken | { openSessionId: string } =
    skipToken;
  if (openSessionId !== null) {
    timelineQueryArg = { openSessionId };
  }
  const timelineQuery = useReadSessionTimelineQuery(timelineQueryArg);
  const [loadOlder] = useLoadOlderSessionTimelineMutation();
  const pendingPrompts = useSelector((state: RootState) =>
    selectPendingPromptsForOpenSession(state, openSessionId),
  );
  const history = timelineHistoryWithPending(
    timelineQuery.data?.history,
    pendingPrompts,
  );

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
    history,
    isError: timelineQuery.isError,
    isFetching: timelineQuery.isFetching,
    isFetchingOlder: timelineQuery.data?.pagination.isFetchingOlder ?? false,
    isLoading: timelineQuery.isLoading,
    isOlderError: timelineQuery.data?.pagination.isOlderError ?? false,
    loadOlderIfNeeded,
  };
}

export { selectPendingPromptsForOpenSession, useSessionTimeline };
