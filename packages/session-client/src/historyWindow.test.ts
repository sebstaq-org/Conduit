import { expect, it } from "vitest";
import { readSessionOpenResponse } from "./historyWindow.js";
import type { ConsumerResponse } from "@conduit/session-contracts";

function sessionOpenResponse(content: unknown): ConsumerResponse {
  return {
    id: "cmd-1",
    ok: true,
    error: null,
    result: {
      sessionId: "session-1",
      configOptions: null,
      modes: null,
      models: null,
      currentModeId: null,
      openSessionId: "open-1",
      revision: 9,
      items: [
        {
          kind: "message",
          id: "item-1",
          role: "agent",
          content: [content],
        },
      ],
      nextCursor: null,
    },
  };
}

it("validates session/open results with generated protocol schemas", () => {
  const response = sessionOpenResponse({ type: "text", text: "ready" });

  expect(readSessionOpenResponse(response).result).toMatchObject({
    openSessionId: "open-1",
    revision: 9,
    items: [{ kind: "message", role: "agent" }],
  });
});

it("rejects session/open results outside the generated contract", () => {
  const response = sessionOpenResponse({
    text: "missing ACP content discriminator",
  });

  expect(() => readSessionOpenResponse(response)).toThrow();
});
