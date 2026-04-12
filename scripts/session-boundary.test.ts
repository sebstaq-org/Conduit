import { describe, expect, test } from "vitest";

import {
  CONDUIT_COMMANDS,
  CONDUIT_TRANSPORT_VERSION,
  CONSUMER_COMMANDS,
  createConsumerCommand,
} from "../packages/session-contracts/src/index.js";
import type { ClientCommandFrame } from "../packages/session-contracts/src/index.js";

const EXPECTED_CONSUMER_COMMANDS = [
  "initialize",
  "session/new",
  "session/prompt",
  "session/cancel",
  "provider/disconnect",
  "projects/add",
  "projects/list",
  "projects/remove",
  "projects/suggestions",
  "projects/update",
  "sessions/grouped",
  "sessions/watch",
  "session/open",
  "session/history",
  "session/watch",
] as const;

describe("shared session boundary", () => {
  test("the shared consumer command set stays canonical", () => {
    expect(CONSUMER_COMMANDS).toEqual(EXPECTED_CONSUMER_COMMANDS);
  });

  test("consumer transport uses versioned correlated websocket frames", () => {
    const command = createConsumerCommand("provider/disconnect", "codex");
    const frame: ClientCommandFrame = {
      v: CONDUIT_TRANSPORT_VERSION,
      type: "command",
      id: command.id,
      command,
    };

    expect(CONDUIT_COMMANDS).not.toContain("snapshot/get");
    expect(CONDUIT_COMMANDS).not.toContain("events/subscribe");
    expect(CONDUIT_COMMANDS).not.toContain("provider/snapshot");
    expect(frame).toMatchObject({
      v: 1,
      type: "command",
      id: command.id,
    });
  });

  test("product watches are explicit shared consumer commands", () => {
    const sessionsWatch = createConsumerCommand("sessions/watch", "all");
    const sessionWatch = createConsumerCommand("session/watch", "all", {
      openSessionId: "open-session-1",
    });

    expect(sessionsWatch).toMatchObject({
      command: "sessions/watch",
      provider: "all",
    });
    expect(sessionWatch).toMatchObject({
      command: "session/watch",
      provider: "all",
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
    const history = createConsumerCommand("session/history", "all", {
      openSessionId: "open-session-1",
      cursor: null,
    });

    expect(opened).toMatchObject({
      command: "session/open",
      provider: "codex",
    });
    expect(history).toMatchObject({
      command: "session/history",
      provider: "all",
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
      updatedWithinDays: null,
    });

    expect(command).toMatchObject({
      command: "sessions/grouped",
      provider: "codex",
      params: {
        updatedWithinDays: null,
      },
    });
  });
});

describe("shared project suggestions boundary", () => {
  test("project suggestions are an explicit all-providers command", () => {
    const command = createConsumerCommand("projects/suggestions", "all", {
      query: "repo",
      limit: 5,
    });

    expect(command).toMatchObject({
      command: "projects/suggestions",
      provider: "all",
      params: {
        query: "repo",
        limit: 5,
      },
    });
  });
});

describe("shared projects boundary", () => {
  test("project display names are mutable by project id", () => {
    const command = createConsumerCommand("projects/update", "all", {
      projectId: "cwd:/repo",
      displayName: "Repo",
    });

    expect(command).toMatchObject({
      command: "projects/update",
      provider: "all",
      params: {
        projectId: "cwd:/repo",
        displayName: "Repo",
      },
    });
  });
});
