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

function requireObjectResult(response: ConsumerResponse): object {
  if (
    typeof response.result !== "object" ||
    response.result === null ||
    Array.isArray(response.result)
  ) {
    throw new Error("expected object result");
  }
  return response.result;
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

it("normalizes generated config option contracts for app-facing UI models", () => {
  const response = sessionOpenResponse({ type: "text", text: "ready" });
  response.result = Object.assign(requireObjectResult(response), {
    configOptions: [
      {
        id: "collaboration_mode",
        name: "Mode",
        type: "select",
        currentValue: "plan",
        options: [
          {
            group: "common",
            name: "Common",
            options: [
              { name: "Plan", value: "plan" },
              { name: "Default", value: "default" },
            ],
          },
        ],
      },
    ],
  });

  expect(readSessionOpenResponse(response).result?.configOptions?.[0]).toEqual(
    expect.objectContaining({
      currentValue: "plan",
      values: [
        { name: "Plan", value: "plan" },
        { name: "Default", value: "default" },
      ],
    }),
  );
});
