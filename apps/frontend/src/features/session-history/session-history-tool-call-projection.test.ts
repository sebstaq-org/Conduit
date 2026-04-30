import { describe, expect, it } from "vitest";
import type { TranscriptItem } from "@conduit/session-client";
import {
  TOOL_CALL_PREVIEW_LIMIT,
  isSessionHistoryToolCallProjection,
  projectSessionHistoryItems,
} from "./session-history-tool-call-projection";
import type { SessionHistoryToolCallProjection } from "./session-history-tool-call-projection";

function userMessage(id: string, text: string): TranscriptItem {
  return {
    content: [{ text, type: "text" }],
    id,
    kind: "message",
    role: "user",
  };
}

function toolCallEvent(args: {
  id: string;
  output?: unknown;
  status?: string;
  title?: string;
  toolCallId: string;
  update?: boolean;
}): TranscriptItem {
  let sessionUpdate = "tool_call";
  let variant = "tool_call";
  if (args.update === true) {
    sessionUpdate = "tool_call_update";
    variant = "tool_call_update";
  }
  return {
    data: {
      kind: "execute",
      rawOutput: args.output,
      sessionUpdate,
      status: args.status,
      title: args.title,
      toolCallId: args.toolCallId,
    },
    id: args.id,
    kind: "event",
    source: "provider",
    variant,
  };
}

function expectToolCallProjection(
  item: unknown,
): SessionHistoryToolCallProjection {
  if (!isSessionHistoryToolCallProjection(item)) {
    throw new Error("expected projected tool call");
  }
  return item;
}

describe("session history tool call merge", () => {
  it("merges tool call updates into one projected item", () => {
    const projected = projectSessionHistoryItems([
      userMessage("user-1", "Run tests"),
      toolCallEvent({
        id: "tool-start",
        status: "in_progress",
        title: "Run command",
        toolCallId: "tool-1",
      }),
      toolCallEvent({
        id: "tool-end",
        output: { aggregated_output: "all tests passed" },
        status: "completed",
        toolCallId: "tool-1",
        update: true,
      }),
    ]);

    expect(projected).toHaveLength(2);
    const toolCall = expectToolCallProjection(projected[1]);
    expect(toolCall.title).toBe("Run command");
    expect(toolCall.statusLabel).toBe("completed");
    expect(toolCall.preview).toBe("all tests passed");
    expect(toolCall.updateCount).toBe(2);
  });
});

describe("session history tool call preview", () => {
  it("keeps large output out of the rendered preview", () => {
    const hugeOutput = `${"A".repeat(5000)}\nTAIL_SENTINEL`;
    const projected = projectSessionHistoryItems([
      toolCallEvent({
        id: "tool-large",
        output: { aggregated_output: hugeOutput },
        status: "completed",
        title: "Huge output",
        toolCallId: "tool-large",
      }),
    ]);
    const toolCall = expectToolCallProjection(projected[0]);

    expect(toolCall).toMatchObject({ truncated: true });
    expect(toolCall.preview?.length).toBeLessThanOrEqual(
      TOOL_CALL_PREVIEW_LIMIT + 6,
    );
    expect(toolCall.preview).toContain("TAIL_SENTINEL");
  });
});

describe("session history non tool-call events", () => {
  it("leaves non tool-call events unchanged", () => {
    const event: TranscriptItem = {
      data: { message: "boom", sessionUpdate: "turn_error" },
      id: "error-1",
      kind: "event",
      source: "conduit",
      variant: "turn_error",
    };

    expect(projectSessionHistoryItems([event])).toEqual([event]);
  });
});
