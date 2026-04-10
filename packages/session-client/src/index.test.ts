import { describe, expect, it } from "vitest";

import { createDesktopProofClient } from "./index.js";

describe("session-client", () => {
  it("stays on the official ACP policy boundary", () => {
    expect(createDesktopProofClient().policy).toBe("official-acp-only");
  });
});
