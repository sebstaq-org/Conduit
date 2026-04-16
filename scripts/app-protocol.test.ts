import { describe, expect, it } from "vitest";

import {
  AcpSessionUpdateSchema,
  AcpToolCallUpdateSchema,
} from "../packages/app-protocol/src/index.js";
import type { AcpSessionUpdate } from "../packages/app-protocol/src/index.js";

describe("generated app protocol contracts", () => {
  it("accepts typed ACP tool call updates", () => {
    const parsed = AcpSessionUpdateSchema.parse({
      sessionUpdate: "tool_call_update",
      toolCallId: "tool-1",
      status: "completed",
      content: [
        {
          type: "content",
          content: {
            type: "text",
            text: "done",
          },
        },
      ],
    }) satisfies AcpSessionUpdate;

    expect(parsed.sessionUpdate).toBe("tool_call_update");
    if (parsed.sessionUpdate === "tool_call_update") {
      expect(parsed.status).toBe("completed");
      expect(parsed.content?.[0]?.type).toBe("content");
    }
  });

  it("rejects invalid ACP tool call statuses", () => {
    expect(() =>
      AcpToolCallUpdateSchema.parse({
        toolCallId: "tool-1",
        status: "done",
      }),
    ).toThrow();
  });
});
