import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ClientCommandFrameSchema,
  CONSUMER_COMMANDS,
  ConsumerCommandSchema,
  type ClientCommandFrame,
  type ConsumerCommand,
  ServerFrameSchema,
  type ServerFrame,
} from "../packages/app-protocol/src/index.js";

const transportVersionField = "v";

function clientCommandFrame(): ClientCommandFrame {
  const command = ConsumerCommandSchema.parse({
    id: "command-1",
    command: "provider/disconnect",
    provider: "codex",
    params: {},
  });
  return ClientCommandFrameSchema.parse({
    [transportVersionField]: 1,
    type: "command",
    id: command.id,
    command,
  });
}

function watchCommands(): {
  sessionWatch: ConsumerCommand;
  sessionsWatch: ConsumerCommand;
} {
  return {
    sessionWatch: ConsumerCommandSchema.parse({
      id: "watch-2",
      command: "session/watch",
      provider: "all",
      params: {
        openSessionId: "open-session-1",
      },
    }),
    sessionsWatch: ConsumerCommandSchema.parse({
      id: "watch-1",
      command: "sessions/watch",
      provider: "all",
      params: {},
    }),
  };
}

function serverFrames(): {
  eventFrame: ServerFrame;
  responseFrame: ServerFrame;
} {
  return {
    eventFrame: ServerFrameSchema.parse({
      [transportVersionField]: 1,
      type: "event",
      event: {
        kind: "session_timeline_changed",
        openSessionId: "open-session-1",
        revision: 7,
        items: [],
      },
    }),
    responseFrame: ServerFrameSchema.parse({
      [transportVersionField]: 1,
      type: "response",
      id: "response-1",
      response: {
        id: "response-1",
        ok: true,
        result: {},
        error: null,
        snapshot: null,
      },
    }),
  };
}

function readCatalogCommands(): string[] {
  const sourcePath = fileURLToPath(
    new URL(
      "../backend/service/crates/service-bin/src/serve/mod.rs",
      import.meta.url,
    ),
  );
  const source = readFileSync(sourcePath, "utf8");
  const arraySectionMatch = /const\s+CATALOG_COMMANDS[^=]*=\s*\[(.*?)\];/s.exec(
    source,
  );
  const catalogCommandArray = arraySectionMatch?.[1];
  if (catalogCommandArray === undefined || catalogCommandArray.length === 0) {
    throw new Error(
      "CATALOG_COMMANDS constant not found in service catalog source",
    );
  }
  return Array.from(
    catalogCommandArray.matchAll(/"([^"]+)"/g),
    (match) => match[1] ?? "",
  );
}

describe("generated session boundary catalog", () => {
  test("rust catalog commands stay aligned with generated contracts", () => {
    expect(readCatalogCommands()).toEqual(CONSUMER_COMMANDS);
  });

  test("generated command catalog excludes old speculative transport commands", () => {
    expect(CONSUMER_COMMANDS).not.toContain("snapshot/get");
    expect(CONSUMER_COMMANDS).not.toContain("events/subscribe");
    expect(CONSUMER_COMMANDS).not.toContain("provider/snapshot");
  });
});

describe("generated wire envelopes", () => {
  test("consumer transport uses versioned correlated websocket frames", () => {
    const frame = clientCommandFrame();

    expect(frame).toMatchObject({
      [transportVersionField]: 1,
      type: "command",
      id: "command-1",
    });
  });

  test("watch commands stay explicit generated consumer commands", () => {
    const { sessionWatch, sessionsWatch } = watchCommands();

    expect(sessionsWatch).toMatchObject({
      command: "sessions/watch",
      provider: "all",
    });
    expect(sessionWatch).toMatchObject({
      command: "session/watch",
      provider: "all",
    });
  });

  test("server frames are parsed from generated response and event variants", () => {
    const { eventFrame, responseFrame } = serverFrames();

    expect(responseFrame.type).toBe("response");
    expect(eventFrame.type).toBe("event");
  });
});
