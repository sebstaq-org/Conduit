import type { SessionHistoryWindow, TranscriptItem } from "./models";

interface SessionTimelinePagination {
  exhausted: boolean;
  inflightCursor: string | null;
  isFetchingOlder: boolean;
  isOlderError: boolean;
}

interface SessionTimelineData {
  history: SessionHistoryWindow;
  pagination: SessionTimelinePagination;
}

interface OlderPageResult {
  cursor: string;
  history: SessionHistoryWindow;
}

interface OlderPageMergeResult {
  merged: boolean;
  reason:
    | "cursor_mismatch"
    | "open_session_mismatch"
    | "revision_mismatch"
    | "merged";
}

function overrideOrDefault<Value>(
  value: Value | undefined,
  fallback: Value,
): Value {
  if (value === undefined) {
    return fallback;
  }
  return value;
}

function withPagination(
  timeline: SessionTimelineData,
  overrides: Partial<SessionTimelinePagination>,
): SessionTimelineData {
  return {
    history: timeline.history,
    pagination: {
      exhausted: overrideOrDefault(
        overrides.exhausted,
        timeline.pagination.exhausted,
      ),
      inflightCursor: overrideOrDefault(
        overrides.inflightCursor,
        timeline.pagination.inflightCursor,
      ),
      isFetchingOlder: overrideOrDefault(
        overrides.isFetchingOlder,
        timeline.pagination.isFetchingOlder,
      ),
      isOlderError: overrideOrDefault(
        overrides.isOlderError,
        timeline.pagination.isOlderError,
      ),
    },
  };
}

function createSessionTimelineData(
  history: SessionHistoryWindow,
): SessionTimelineData {
  return {
    history,
    pagination: {
      exhausted: history.nextCursor === null,
      inflightCursor: null,
      isFetchingOlder: false,
      isOlderError: false,
    },
  };
}

function turnIdFor(item: TranscriptItem): string | null {
  return item.turnId ?? null;
}

function isTurnId(value: string | null): value is string {
  return value !== null;
}

function turnIdsFor(items: TranscriptItem[]): Set<string> {
  return new Set(
    items.map((item) => turnIdFor(item)).filter((value) => isTurnId(value)),
  );
}

function applyTimelineItems(
  timeline: SessionTimelineData,
  revision: number,
  items: TranscriptItem[],
): SessionTimelineData {
  const turnIds = turnIdsFor(items);
  if (turnIds.size === 0) {
    return {
      history: {
        items: timeline.history.items,
        nextCursor: timeline.history.nextCursor,
        openSessionId: timeline.history.openSessionId,
        revision,
      },
      pagination: timeline.pagination,
    };
  }
  const retainedItems = timeline.history.items.filter(
    (item: TranscriptItem) => {
      const turnId = turnIdFor(item);
      return turnId === null || !turnIds.has(turnId);
    },
  );
  return {
    history: {
      items: [...retainedItems, ...items],
      nextCursor: timeline.history.nextCursor,
      openSessionId: timeline.history.openSessionId,
      revision,
    },
    pagination: timeline.pagination,
  };
}

function beginOlderPageLoad(
  timeline: SessionTimelineData,
  cursor: string,
): SessionTimelineData {
  if (timeline.history.nextCursor !== cursor) {
    return timeline;
  }
  if (
    timeline.pagination.isFetchingOlder &&
    timeline.pagination.inflightCursor === cursor
  ) {
    return timeline;
  }
  return withPagination(timeline, {
    inflightCursor: cursor,
    isFetchingOlder: true,
    isOlderError: false,
  });
}

function failOlderPageLoad(
  timeline: SessionTimelineData,
  cursor: string,
): SessionTimelineData {
  if (timeline.pagination.inflightCursor !== cursor) {
    return timeline;
  }
  return withPagination(timeline, {
    inflightCursor: null,
    isFetchingOlder: false,
    isOlderError: true,
  });
}

function prependOlderItems(
  currentItems: TranscriptItem[],
  olderItems: TranscriptItem[],
): TranscriptItem[] {
  const currentIds = new Set(currentItems.map((item) => item.id));
  const uniqueOlderItems = olderItems.filter(
    (item) => !currentIds.has(item.id),
  );
  return [...uniqueOlderItems, ...currentItems];
}

function mergedOlderPageTimeline(
  timeline: SessionTimelineData,
  history: SessionHistoryWindow,
): SessionTimelineData {
  return {
    history: {
      items: prependOlderItems(timeline.history.items, history.items),
      nextCursor: history.nextCursor,
      openSessionId: timeline.history.openSessionId,
      revision: history.revision,
    },
    pagination: {
      exhausted: history.nextCursor === null,
      inflightCursor: null,
      isFetchingOlder: false,
      isOlderError: false,
    },
  };
}

function mergeOlderPage(
  timeline: SessionTimelineData,
  olderPage: OlderPageResult,
): [SessionTimelineData, OlderPageMergeResult] {
  const { cursor, history } = olderPage;
  if (timeline.history.nextCursor !== cursor) {
    return [
      withPagination(timeline, {
        inflightCursor: null,
        isFetchingOlder: false,
        isOlderError: false,
      }),
      { merged: false, reason: "cursor_mismatch" },
    ];
  }
  if (timeline.history.openSessionId !== history.openSessionId) {
    return [
      withPagination(timeline, {
        inflightCursor: null,
        isFetchingOlder: false,
        isOlderError: true,
      }),
      { merged: false, reason: "open_session_mismatch" },
    ];
  }
  if (timeline.history.revision !== history.revision) {
    return [
      withPagination(timeline, {
        inflightCursor: null,
        isFetchingOlder: false,
        isOlderError: true,
      }),
      { merged: false, reason: "revision_mismatch" },
    ];
  }
  return [
    mergedOlderPageTimeline(timeline, history),
    { merged: true, reason: "merged" },
  ];
}

export {
  applyTimelineItems,
  beginOlderPageLoad,
  createSessionTimelineData,
  failOlderPageLoad,
  mergeOlderPage,
};
export type {
  OlderPageMergeResult,
  OlderPageResult,
  SessionTimelineData,
  SessionTimelinePagination,
};
