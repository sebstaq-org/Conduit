import { describe, expect, it } from "vitest";
import {
  textFromContentBlocks,
  transcriptItemLabel,
  transcriptItemMeta,
} from "./session-history-content";
import type { TranscriptItem } from "@conduit/session-client";

describe("session history content", () => {
  it("renders text blocks from ACP content without replacing the source shape", () => {
    expect(
      textFromContentBlocks([
        { type: "text", text: "hello" },
        { type: "resource", resource: { uri: "file:///example" } },
        { type: "text", text: " world" },
      ]),
    ).toBe("hello world");
  });

  it("keeps event variants visible in the timeline", () => {
    const item: TranscriptItem = {
      data: { sessionUpdate: "tool_call" },
      id: "event-1",
      kind: "event",
      variant: "tool_call",
    };

    expect(transcriptItemLabel(item)).toBe("tool_call");
    expect(transcriptItemMeta(item)).toBe("event");
  });
});
