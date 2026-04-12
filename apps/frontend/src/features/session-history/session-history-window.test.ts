import { describe, expect, it } from "vitest";
import {
  currentOlderPageFor,
  historyViewState,
  nextOlderHistoryState,
} from "./session-history-window";
import type { SessionHistoryWindow } from "@conduit/session-client";

interface HistoryWindowFixture {
  itemIds: string[];
  nextCursor: string | null;
  openSessionId: string;
  revision: number;
}

function historyWindow({
  itemIds,
  nextCursor,
  openSessionId,
  revision,
}: HistoryWindowFixture): SessionHistoryWindow {
  return {
    items: itemIds.map((id) => ({
      content: [{ text: id, type: "text" }],
      id,
      kind: "message",
      role: "agent",
    })),
    nextCursor,
    openSessionId,
    revision,
  };
}

describe("session history window state", () => {
  it("does not merge stale older cursor data when loading another older page", () => {
    const latest = historyWindow({
      itemIds: ["latest"],
      nextCursor: "cursor-1",
      openSessionId: "open-session-1",
      revision: 3,
    });
    const firstOlder = historyWindow({
      itemIds: ["first older"],
      nextCursor: "cursor-2",
      openSessionId: "open-session-1",
      revision: 3,
    });
    const requestedFirst = nextOlderHistoryState({
      data: latest,
      olderHistory: null,
      olderPage: undefined,
      openSessionId: "open-session-1",
    });
    const acceptedFirst = currentOlderPageFor(
      requestedFirst,
      "cursor-1",
      firstOlder,
    );
    const requestedSecond = nextOlderHistoryState({
      data: latest,
      olderHistory: requestedFirst,
      olderPage: acceptedFirst,
      openSessionId: "open-session-1",
    });
    const staleFirst = currentOlderPageFor(
      requestedSecond,
      "cursor-1",
      firstOlder,
    );

    const view = historyViewState(latest, requestedSecond, staleFirst);

    expect(staleFirst).toBeUndefined();
    expect(view.history?.items.map((item) => item.id)).toEqual([
      "first older",
      "latest",
    ]);
    expect(view.history?.nextCursor).toBe("cursor-2");
  });
});

describe("session history latest window guard", () => {
  it("does not start older pagination when latest data belongs to another open session", () => {
    const latest = historyWindow({
      itemIds: ["latest"],
      nextCursor: "cursor-1",
      openSessionId: "open-session-1",
      revision: 3,
    });

    const requested = nextOlderHistoryState({
      data: latest,
      olderHistory: null,
      olderPage: undefined,
      openSessionId: "open-session-2",
    });

    expect(requested).toBeNull();
  });
});
