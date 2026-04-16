/* eslint-disable vitest/prefer-to-be-falsy, vitest/prefer-to-be-truthy */

import { describe, expect, it } from "vitest";
import {
  applyTimelineItems,
  beginOlderPageLoad,
  createSessionTimelineData,
  failOlderPageLoad,
  mergeOlderPage,
} from "./session-timeline-cache";
import type { SessionHistoryWindow, TranscriptItem } from "./models";

interface HistoryFixture {
  ids: string[];
  nextCursor: string | null;
  openSessionId: string;
  revision: number;
}

function historyWindow({
  ids,
  nextCursor,
  openSessionId,
  revision,
}: HistoryFixture): SessionHistoryWindow {
  return {
    items: ids.map((id) => ({
      content: [{ kind: "text", text: id }],
      id,
      kind: "message",
      role: "agent",
      turnId: id,
    })),
    nextCursor,
    openSessionId,
    revision,
  };
}

describe("session timeline cache older-page merge", () => {
  it("merges older pages using one cursor chain", () => {
    const latest = createSessionTimelineData(
      historyWindow({
        ids: ["new-a", "new-b"],
        nextCursor: "cursor-1",
        openSessionId: "open-1",
        revision: 4,
      }),
    );

    const loading = beginOlderPageLoad(latest, "cursor-1");
    const [merged, result] = mergeOlderPage(loading, {
      cursor: "cursor-1",
      history: historyWindow({
        ids: ["old-a", "old-b"],
        nextCursor: "cursor-2",
        openSessionId: "open-1",
        revision: 4,
      }),
    });

    expect(result).toEqual({ merged: true, reason: "merged" });
    expect(merged.history.items.map((item: TranscriptItem) => item.id)).toEqual(
      ["old-a", "old-b", "new-a", "new-b"],
    );
    expect(merged.history.nextCursor).toBe("cursor-2");
    expect(merged.pagination.isFetchingOlder).toBe(false);
    expect(merged.pagination.inflightCursor).toBeNull();
  });
});

describe("session timeline cache stale older-page responses", () => {
  it("drops stale older responses after cursor advanced", () => {
    const timeline = createSessionTimelineData(
      historyWindow({
        ids: ["new"],
        nextCursor: "cursor-2",
        openSessionId: "open-1",
        revision: 2,
      }),
    );

    const [updated, result] = mergeOlderPage(timeline, {
      cursor: "cursor-1",
      history: historyWindow({
        ids: ["old"],
        nextCursor: null,
        openSessionId: "open-1",
        revision: 2,
      }),
    });

    expect(result).toEqual({ merged: false, reason: "cursor_mismatch" });
    expect(
      updated.history.items.map((item: TranscriptItem) => item.id),
    ).toEqual(["new"]);
  });
});

describe("session timeline cache older-page failures", () => {
  it("fails older state when the in-flight cursor errors", () => {
    const timeline = beginOlderPageLoad(
      createSessionTimelineData(
        historyWindow({
          ids: ["new"],
          nextCursor: "cursor-1",
          openSessionId: "open-1",
          revision: 2,
        }),
      ),
      "cursor-1",
    );

    const failed = failOlderPageLoad(timeline, "cursor-1");

    expect(failed.pagination.isFetchingOlder).toBe(false);
    expect(failed.pagination.isOlderError).toBe(true);
    expect(failed.pagination.inflightCursor).toBeNull();
  });
});

describe("session timeline cache live turn projection", () => {
  it("applies live timeline updates by replacing matching turn items", () => {
    const timeline = createSessionTimelineData(
      historyWindow({
        ids: ["turn-1-old", "turn-2-old"],
        nextCursor: null,
        openSessionId: "open-1",
        revision: 1,
      }),
    );

    const updated = applyTimelineItems(timeline, 3, [
      {
        content: [{ kind: "text", text: "turn-2-new" }],
        id: "turn-2-new",
        kind: "message",
        role: "agent",
        turnId: "turn-2-old",
      },
    ]);

    expect(updated.history.revision).toBe(3);
    expect(
      updated.history.items.map((item: TranscriptItem) => item.id),
    ).toEqual(["turn-1-old", "turn-2-new"]);
  });
});
