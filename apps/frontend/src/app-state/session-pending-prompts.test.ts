import { describe, expect, it } from "vitest";
import { withPendingPromptMessages } from "./session-pending-prompts";
import type {
  SessionHistoryWindow,
  TranscriptItem,
} from "@conduit/session-client";
import type { PendingPromptMessage } from "./session-pending-prompts";

function userItem(id: string, text: string, turnId?: string): TranscriptItem {
  return {
    content: [{ text, type: "text" }],
    id,
    kind: "message",
    role: "user",
    turnId,
  };
}

function agentItem(id: string, text: string, turnId?: string): TranscriptItem {
  return {
    content: [{ text, type: "text" }],
    id,
    kind: "message",
    role: "agent",
    turnId,
  };
}

function history(
  revision: number,
  items: TranscriptItem[] = [],
): SessionHistoryWindow {
  return {
    items,
    nextCursor: null,
    openSessionId: "open-session-1",
    revision,
  };
}

function pending(
  text: string,
  baseRevision: number,
  baseLastItemId: string | null = null,
): PendingPromptMessage {
  return {
    baseLastItemId,
    baseRevision,
    id: `pending:${baseRevision}:${text}`,
    openSessionId: "open-session-1",
    submittedAt: baseRevision,
    text,
  };
}

describe("pending prompt timeline projection before backend ack", () => {
  it("appends a pending user prompt before backend advances the timeline", () => {
    const projected = withPendingPromptMessages(history(4), [
      pending("hello", 4),
    ]);

    expect(projected.items).toEqual([
      {
        content: [{ text: "hello", type: "text" }],
        id: "pending:4:hello",
        kind: "message",
        role: "user",
        status: "complete",
      },
    ]);
  });

  it("keeps pending visible when old history already has the same text", () => {
    const projected = withPendingPromptMessages(
      history(4, [userItem("turn-1-user", "hello", "turn-1")]),
      [pending("hello", 4, "turn-1-user")],
    );

    expect(projected.items.map((item) => item.id)).toEqual([
      "turn-1-user",
      "pending:4:hello",
    ]);
  });
});

describe("pending prompt timeline projection after backend ack", () => {
  it("removes pending when backend emits the matching user prompt on a newer revision", () => {
    const projected = withPendingPromptMessages(
      history(5, [userItem("turn-2-user", "hello", "turn-2")]),
      [pending("hello", 4)],
    );

    expect(projected.items.map((item) => item.id)).toEqual(["turn-2-user"]);
  });

  it("removes draft-session pending when the backend user item is already present at the base revision", () => {
    const projected = withPendingPromptMessages(
      history(5, [userItem("turn-2-user", "hello", "turn-2")]),
      [pending("hello", 5)],
    );

    expect(projected.items.map((item) => item.id)).toEqual(["turn-2-user"]);
  });

  it("does not remove pending for agent-only streaming updates", () => {
    const projected = withPendingPromptMessages(
      history(5, [agentItem("turn-2-agent", "reply", "turn-2")]),
      [pending("hello", 4)],
    );

    expect(projected.items.map((item) => item.id)).toEqual([
      "turn-2-agent",
      "pending:4:hello",
    ]);
  });

  it("handles repeated identical prompts by base revision", () => {
    const projected = withPendingPromptMessages(
      history(6, [userItem("turn-2-user", "hello", "turn-2")]),
      [pending("hello", 4), pending("hello", 6, "turn-2-user")],
    );

    expect(projected.items.map((item) => item.id)).toEqual([
      "turn-2-user",
      "pending:6:hello",
    ]);
  });
});

describe("pending prompt timeline projection during agent-only streaming", () => {
  it("keeps pending user prompts before updates from the submitted turn", () => {
    const projected = withPendingPromptMessages(
      history(5, [
        userItem("turn-1-user", "old", "turn-1"),
        agentItem("turn-1-agent", "old reply", "turn-1"),
        agentItem("turn-2-agent", "streaming reply", "turn-2"),
      ]),
      [pending("follow up", 4, "turn-1-agent")],
    );

    expect(projected.items.map((item) => item.id)).toEqual([
      "turn-1-user",
      "turn-1-agent",
      "pending:4:follow up",
      "turn-2-agent",
    ]);
  });
});
