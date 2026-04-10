import { describe, expect, test } from "vitest";

import { createDesktopBootstrapPlan } from "../apps/desktop/src/index.js";
import { createMobileBootstrapPlan } from "../apps/mobile/src/index.js";
import { CONSUMER_COMMANDS } from "../packages/session-contracts/src/index.js";

describe("shared session boundary", () => {
  test("desktop and mobile expose the same consumer command set", () => {
    const desktop = createDesktopBootstrapPlan();
    const mobile = createMobileBootstrapPlan();

    expect(desktop.supportedCommands).toEqual([...CONSUMER_COMMANDS]);
    expect(mobile.supportedCommands).toEqual([...CONSUMER_COMMANDS]);
  });
});
