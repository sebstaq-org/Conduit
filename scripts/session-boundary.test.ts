import { describe, expect, test } from "vitest";

import {
  CONDUIT_COMMANDS,
  CONDUIT_TRANSPORT_VERSION,
  CONSUMER_COMMANDS,
  createConsumerCommand,
} from "../packages/session-contracts/src/index.js";

describe("shared session boundary", () => {
  test("the shared consumer command set stays canonical", () => {
    expect(CONSUMER_COMMANDS).toEqual([
      "initialize",
      "session/new",
      "session/list",
      "session/load",
      "session/prompt",
      "session/cancel",
      "snapshot/get",
      "provider/disconnect",
      "events/subscribe",
    ]);
  });

  test("consumer transport uses versioned correlated websocket frames", () => {
    const command = createConsumerCommand("snapshot/get", "codex");

    expect(CONDUIT_COMMANDS).toContain("snapshot/get");
    expect(CONDUIT_COMMANDS).not.toContain("provider/snapshot");
    expect({
      v: CONDUIT_TRANSPORT_VERSION,
      type: "command",
      id: command.id,
      command,
    }).toMatchObject({
      v: 1,
      type: "command",
      id: command.id,
    });
  });

  test("event subscription is an explicit shared consumer command", () => {
    const command = createConsumerCommand("events/subscribe", "codex", {
      after_sequence: null,
    });

    expect(command).toMatchObject({
      command: "events/subscribe",
      provider: "codex",
      params: {
        after_sequence: null,
      },
    });
  });
});
