import { expect, it } from "vitest";
import { readClientIdentity } from "./client-identity";

it("accepts persisted mobile client identity for presence heartbeat", () => {
  // Per user contract: mobile/web identity is stable per install and is the counted client.
  // Do not change without an explicit product decision.
  expect(
    readClientIdentity({
      clientId: "client-1",
      deviceKind: "mobile",
      displayName: "Base iPhone",
    }),
  ).toEqual({
    clientId: "client-1",
    deviceKind: "mobile",
    displayName: "Base iPhone",
  });
});

it("rejects desktop client identity because desktop is the host", () => {
  // Per user contract: desktop UI must not register itself as an external client.
  // Do not change without an explicit product decision.
  expect(
    readClientIdentity({
      clientId: "desktop-ui",
      deviceKind: "desktop",
      displayName: "Desktop UI",
    }),
  ).toBeNull();
});
