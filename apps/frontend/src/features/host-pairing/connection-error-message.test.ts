import { describe, expect, it } from "vitest";
import { connectionErrorMessage } from "./connection-error-message";

describe("relay connection diagnostics", () => {
  it("renders RTK status errors with useful details", () => {
    expect(
      connectionErrorMessage({
        data: { message: "relay websocket failed to connect" },
        status: "CUSTOM_ERROR",
      }),
    ).toBe("Relay error CUSTOM_ERROR: relay websocket failed to connect");
  });

  it("renders serialized errors", () => {
    expect(connectionErrorMessage({ message: "daemon disconnected" })).toBe(
      "daemon disconnected",
    );
  });

  it("ignores unknown error shapes", () => {
    expect(connectionErrorMessage({ nope: true })).toBeNull();
  });
});
