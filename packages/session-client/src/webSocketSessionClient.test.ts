import { ConduitSessionWatchResultSchema } from "@conduit/app-protocol";
import { expect, it } from "vitest";
import { confirmGeneratedSubscription } from "./webSocketSessionClient.js";

it("runs subscription cleanup when generated watch ack parsing fails", () => {
  let cleanedUp = false;

  expect(() => {
    confirmGeneratedSubscription(
      { subscribed: true },
      () => {
        cleanedUp = true;
      },
      (result) => ConduitSessionWatchResultSchema.parse(result),
    );
  }).toThrow();
  if (!cleanedUp) {
    throw new Error("subscription cleanup did not run");
  }
});
