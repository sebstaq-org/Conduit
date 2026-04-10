import { describe, expect, it } from "vitest";

import { createBootstrapSessionClient } from "./index.js";

describe("session-client", () => {
  it("stays on the official ACP policy boundary", async () => {
    const client = createBootstrapSessionClient();
    const snapshot = await client.getProviderSnapshot("claude");

    expect(client.policy).toBe("official-acp-only");
    expect(snapshot.ready).toBe(false);
    expect(snapshot.note).toContain("Phase 0.5");
  });
});
