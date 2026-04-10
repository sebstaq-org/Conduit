import { describe, expect, test } from "vitest";

import { createDesktopProofConfig } from "../src/proof-config.js";

describe("desktop proof config", () => {
  test("uses package-owned provider/action/copy truth", () => {
    const config = createDesktopProofConfig("/repo/root");

    expect(config.providers).toEqual(["claude", "copilot", "codex"]);
    expect(config.actions).toEqual([
      "connect",
      "new",
      "list",
      "load",
      "prompt",
      "cancel",
    ]);
    expect(config.copy.title).toBe("Conduit desktop ACP proof");
    expect(config.defaultCwd).toBe("/repo/root");
  });
});
