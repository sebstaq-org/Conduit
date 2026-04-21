import { expect, it } from "vitest";
import type { SessionConfigOption } from "@conduit/session-client";
import {
  displayProviderName,
  displaySessionConfigOptionValue,
} from "./session-composer-display";

function selectOption(args: {
  currentValue: string;
  id: string;
  values: { name: string; value: string }[];
}): SessionConfigOption {
  return {
    category: null,
    currentValue: args.currentValue,
    description: null,
    id: args.id,
    name: args.id,
    type: "select",
    values: args.values,
  };
}

it("shows selected config values without their option labels", () => {
  expect(
    displaySessionConfigOptionValue(
      selectOption({
        currentValue: "plan",
        id: "collaboration_mode",
        values: [{ name: "Plan", value: "plan" }],
      }),
    ),
  ).toBe("Plan");
  expect(
    displaySessionConfigOptionValue(
      selectOption({
        currentValue: "medium",
        id: "reasoning_effort",
        values: [{ name: "medium", value: "medium" }],
      }),
    ),
  ).toBe("Medium");
});

it("uses compact model names and capitalizes model fallback words", () => {
  expect(
    displaySessionConfigOptionValue(
      selectOption({
        currentValue: "default",
        id: "model",
        values: [{ name: "Default (recommended)", value: "default" }],
      }),
    ),
  ).toBe("Default");
  expect(
    displaySessionConfigOptionValue(
      selectOption({
        currentValue: "gpt-5-mini",
        id: "model",
        values: [],
      }),
    ),
  ).toBe("GPT-5-mini");
});

it("capitalizes provider names", () => {
  expect(displayProviderName("codex")).toBe("Codex");
  expect(displayProviderName(null)).toBe("Select provider");
});
