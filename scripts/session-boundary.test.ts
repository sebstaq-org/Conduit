import { describe, expect, test } from "vitest";

import { createDesktopBootstrapPlan } from "../apps/desktop/src/index.js";
import { createMobileBootstrapPlan } from "../apps/mobile/src/index.js";
import {
  CONDUIT_COMMANDS,
  CONDUIT_TRANSPORT_VERSION,
  CONSUMER_COMMANDS,
  createConsumerCommand,
} from "../packages/session-contracts/src/index.js";

describe("shared session boundary", () => {
  test("desktop and mobile expose the same consumer command set", () => {
    const desktop = createDesktopBootstrapPlan();
    const mobile = createMobileBootstrapPlan();

    expect(desktop.supportedCommands).toEqual([...CONSUMER_COMMANDS]);
    expect(mobile.supportedCommands).toEqual([...CONSUMER_COMMANDS]);
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
