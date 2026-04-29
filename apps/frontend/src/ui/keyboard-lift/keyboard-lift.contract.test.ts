import { describe, expect, it } from "vitest";
import { keyboardLiftMode } from "./keyboard-lift.contract";

describe("keyboard lift platform contract", () => {
  it("uses keyboard avoiding layout on Android without position-shifting the whole screen", () => {
    expect(keyboardLiftMode("android")).toBe("avoid");
  });

  it("keeps keyboard avoiding layout on iOS", () => {
    expect(keyboardLiftMode("ios")).toBe("avoid");
  });

  it("uses plain layout on web", () => {
    expect(keyboardLiftMode("web")).toBe("plain");
  });
});
