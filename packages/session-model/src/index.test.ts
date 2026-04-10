import { describe, expect, it } from "vitest";

import { createSessionIdentity, createSessionSnapshot } from "./index.js";

describe("session-model", () => {
  it("keeps live identity as provider plus ACP session id", () => {
    const identity = createSessionIdentity("codex", "session-123");
    const snapshot = createSessionSnapshot(identity, "Bootstrap");

    expect(identity).toEqual({
      provider: "codex",
      acpSessionId: "session-123",
    });
    expect(snapshot.lifecycle).toBe("ready");
  });
});
