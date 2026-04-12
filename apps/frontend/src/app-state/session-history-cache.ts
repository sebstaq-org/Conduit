import type {
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";

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
  history: SessionHistoryWindow,
  revision: number,
  items: TranscriptItem[],
): SessionHistoryWindow {
  const turnIds = turnIdsFor(items);
  if (turnIds.size === 0) {
    return {
      items: history.items,
      nextCursor: history.nextCursor,
      openSessionId: history.openSessionId,
      revision,
    };
  }
  const retainedItems = history.items.filter((item) => {
    const turnId = turnIdFor(item);
    return turnId === null || !turnIds.has(turnId);
  });
  return {
    items: [...retainedItems, ...items],
    nextCursor: history.nextCursor,
    openSessionId: history.openSessionId,
    revision,
  };
}

export { applyTimelineItems };
