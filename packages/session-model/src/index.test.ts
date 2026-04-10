import { describe, expect, it } from "vitest";

import { createLiveSessionIdentity } from "./index.js";

describe("session-model", () => {
  it("keeps live identity locked to provider plus ACP session id", () => {
    expect(createLiveSessionIdentity("codex", "session-123")).toEqual({
      provider: "codex",
      acpSessionId: "session-123",
    });
  });
});
