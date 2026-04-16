import { describe, expect, it } from "vitest";
import {
  textFromTranscriptContent,
  transcriptItemLabel,
  transcriptItemMeta,
} from "./session-history-content";
import type { TranscriptItem } from "@/app-state/models";

describe("session history content", () => {
  it("renders text from app-facing transcript content", () => {
    expect(
      textFromTranscriptContent([
        { kind: "text", text: "hello" },
        { kind: "unsupported", type: "resource" },
        { kind: "text", text: " world" },
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
