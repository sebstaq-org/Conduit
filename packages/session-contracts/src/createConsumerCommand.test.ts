import { expect, it } from "vitest";
import { createConsumerCommand } from "./createConsumerCommand.js";

it("creates a strict presence update command for external client heartbeat", () => {
  // Per user contract: desktop green is based on explicit external client presence.
  // Do not change without an explicit product decision.
  expect(
    createConsumerCommand("presence/update", "all", {
      clientId: "client-1",
      deviceKind: "mobile",
      displayName: "Base iPhone",
    }),
  ).toMatchObject({
    command: "presence/update",
    provider: "all",
    params: {
      clientId: "client-1",
      deviceKind: "mobile",
      displayName: "Base iPhone",
    },
  });
});

it("rejects desktop as a presence client device kind", () => {
  // Per user contract: desktop is the host in product language, not a counted client.
  // Do not change without an explicit product decision.
  expect(() =>
    createConsumerCommand("presence/update", "all", {
      clientId: "client-1",
      deviceKind: "desktop",
      displayName: "Desktop UI",
    }),
  ).toThrow(/presence\/update params are invalid/u);
});
