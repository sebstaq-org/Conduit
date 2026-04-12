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
      "session/prompt",
      "session/cancel",
      "snapshot/get",
      "provider/disconnect",
      "events/subscribe",
      "sessions/grouped",
      "session/open",
      "session/history",
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

describe("shared session history boundary", () => {
  test("session open and history are explicit provider commands", () => {
    const opened = createConsumerCommand("session/open", "codex", {
      sessionId: "session-1",
      cwd: "/repo",
      limit: 40,
    });
    const history = createConsumerCommand("session/history", "codex", {
      openSessionId: "open-session-1",
      cursor: null,
    });

    expect(opened).toMatchObject({
      command: "session/open",
      provider: "codex",
    });
    expect(history).toMatchObject({
      command: "session/history",
      provider: "codex",
    });
  });
});

describe("shared session grouping boundary", () => {
  test("grouped sessions is an explicit all-providers command", () => {
    const command = createConsumerCommand("sessions/grouped", "all", {
      updatedWithinDays: 5,
    });

    expect(command).toMatchObject({
      command: "sessions/grouped",
      provider: "all",
      params: {
        updatedWithinDays: 5,
      },
    });
  });

  test("grouped sessions can target one provider", () => {
    const command = createConsumerCommand("sessions/grouped", "codex", {
      cwdFilters: ["/repo"],
    });

    expect(command).toMatchObject({
      command: "sessions/grouped",
      provider: "codex",
      params: {
        cwdFilters: ["/repo"],
      },
    });
  });
});
