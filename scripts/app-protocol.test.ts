import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  AcpSessionUpdateSchema,
  AcpToolCallUpdateSchema,
  ConduitServerFrameSchema,
  ConduitSessionOpenResultSchema,
} from "../packages/app-protocol/src/index.js";
import type { AcpSessionUpdate } from "../packages/app-protocol/src/index.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const parsedFixtures: unknown = JSON.parse(
  readFileSync(new URL("app-protocol.fixtures.json", import.meta.url), "utf8"),
);

if (!isRecord(parsedFixtures)) {
  throw new TypeError("app protocol fixtures must be a JSON object");
}

const appProtocolFixtures = parsedFixtures;
const protocolVersionField = "v";

const malformedConfigOptionUpdate = {
  sessionUpdate: "config_option_update",
  configOptions: [
    {
      id: "model",
      name: "Model",
      type: "select",
      currentValue: "gpt-5.4",
      options: [
        {
          value: "gpt-5.4",
        },
      ],
    },
  ],
};

const malformedEmbeddedResourceUpdate = {
  sessionUpdate: "agent_message_chunk",
  content: {
    type: "resource",
    resource: {
      uri: "file:///workspace/context.md",
    },
  },
};

describe("generated app protocol contracts", () => {
  it("accepts typed ACP tool call updates", () => {
    const parsed = AcpSessionUpdateSchema.parse(
      appProtocolFixtures.toolCallUpdate,
    ) satisfies AcpSessionUpdate;

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

  it("accepts backend-serde parity fixtures", () => {
    for (const fixture of Object.values(appProtocolFixtures)) {
      expect(() => AcpSessionUpdateSchema.parse(fixture)).not.toThrow();
    }
  });

  it("rejects malformed ACP session config options", () => {
    expect(() =>
      AcpSessionUpdateSchema.parse(malformedConfigOptionUpdate),
    ).toThrow();
  });

  it("rejects malformed embedded resources", () => {
    expect(() =>
      AcpSessionUpdateSchema.parse(malformedEmbeddedResourceUpdate),
    ).toThrow();
  });
});

it("rejects extra fields on generated Conduit wire contracts", () => {
  expect(() =>
    ConduitServerFrameSchema.parse({
      [protocolVersionField]: 1,
      type: "event",
      event: {
        kind: "sessions_index_changed",
        revision: 4,
      },
      unexpected: true,
    }),
  ).toThrow();

  expect(() =>
    ConduitSessionOpenResultSchema.parse({
      sessionId: "session-1",
      configOptions: null,
      modes: null,
      models: null,
      currentModeId: null,
      openSessionId: "open-1",
      revision: 9,
      items: [],
      nextCursor: null,
      unexpected: true,
    }),
  ).toThrow();
});
