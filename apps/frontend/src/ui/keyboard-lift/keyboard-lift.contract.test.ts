import { describe, expect, it } from "vitest";
import { keyboardLiftMode } from "./keyboard-lift.contract";

describe("keyboard lift platform contract", () => {
  it("uses plain layout on Android so adjustResize owns keyboard movement", () => {
    expect(keyboardLiftMode("android")).toBe("plain");
  });

  it("keeps keyboard avoiding layout on iOS", () => {
    expect(keyboardLiftMode("ios")).toBe("avoid");
  });

  it("uses plain layout on web", () => {
    expect(keyboardLiftMode("web")).toBe("plain");
  });
});
