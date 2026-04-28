import { describe, expect, it } from "vitest";
import { mobilePairingUrl } from "./pairing.js";

describe("desktop pairing URLs", () => {
  it("converts service fragments into dev mobile query links", () => {
    expect(
      mobilePairingUrl(
        "conduit-dev://pair",
        "http://127.0.0.1:4174/#offer=abc123",
      ),
    ).toBe("conduit-dev://pair?offer=abc123");
  });

  it("keeps stage mobile query links on the stage scheme", () => {
    expect(
      mobilePairingUrl("conduit://pair", "http://127.0.0.1:4174/#offer=abc123"),
    ).toBe("conduit://pair?offer=abc123");
  });

  it("fails when service pairing is missing an offer fragment", () => {
    expect(() =>
      mobilePairingUrl("conduit-dev://pair", "http://127.0.0.1:4174/"),
    ).toThrow(/did not contain #offer/u);
  });
});
