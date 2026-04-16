/* eslint-disable import/no-nodejs-modules, vitest/prefer-strict-boolean-matchers, vitest/prefer-to-be-falsy */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IMPLEMENT_PLAN_USER_MESSAGE,
} from "./plan-interaction-types";
import {
  activePlanInteractionCard,
  interactionRequestData,
  interactionResolutionData,
} from "./plan-interaction-projection";
import {
  createPlanInteractionFixtureState,
  promptPlanInteractionFixture,
  respondPlanInteractionFixture,
  startPlanInteractionFixture,
} from "./plan-interaction-dev-fixture";

function activeQuestionId(
  state: ReturnType<typeof createPlanInteractionFixtureState>,
): string | null {
  return (
    activePlanInteractionCard({
      collaborationMode: state.collaborationMode,
      items: state.historyItems,
    })?.questionId ?? null
  );
}

function selectedResponse(args: {
  interactionId: string;
  optionId: string;
}): Parameters<typeof respondPlanInteractionFixture>[1] {
  return {
    interactionId: args.interactionId,
    openSessionId: "plan-interaction-dev-fixture",
    response: { kind: "selected", optionId: args.optionId },
  };
}

function startProductFlowFixture(): ReturnType<
  typeof createPlanInteractionFixtureState
> {
  return startPlanInteractionFixture(
    createPlanInteractionFixtureState(),
    "product-flow",
  );
}

function chooseFixtureOption(args: {
  interactionId: string;
  optionId: string;
  state: ReturnType<typeof createPlanInteractionFixtureState>;
}): ReturnType<typeof createPlanInteractionFixtureState> {
  return respondPlanInteractionFixture(
    args.state,
    selectedResponse({
      interactionId: args.interactionId,
      optionId: args.optionId,
    }),
  );
}

function stateAtFirstPlanDecision(): ReturnType<
  typeof createPlanInteractionFixtureState
> {
  let state = startProductFlowFixture();
  state = chooseFixtureOption({
    interactionId: "fixture-clarify-1",
    optionId: "theme-everyday",
    state,
  });
  return chooseFixtureOption({
    interactionId: "fixture-clarify-2",
    optionId: "scope-three-steps",
    state,
  });
}

function stateAtSecondPlanDecision(): ReturnType<
  typeof createPlanInteractionFixtureState
> {
  const revised = promptPlanInteractionFixture(
    stateAtFirstPlanDecision(),
    "Ändra planen.",
  );
  return chooseFixtureOption({
    interactionId: "fixture-followup-1",
    optionId: "scope-narrow",
    state: revised,
  });
}

describe("plan interaction fixture source", () => {
  it("projects backend-shaped questions and resolutions", () => {
    const state = startProductFlowFixture();
    expect(activeQuestionId(state)).toBe("question-theme");
    expect(interactionRequestData(state.historyItems[0])?.sessionUpdate).toBe(
      "interaction_request",
    );

    const answered = chooseFixtureOption({
      interactionId: "fixture-clarify-1",
      optionId: "theme-everyday",
      state,
    });
    expect(interactionResolutionData(answered.historyItems[1])?.status).toBe(
      "resolved",
    );
    expect(activeQuestionId(answered)).toBe("question-detail-level");
  });

  it("pauses on proposed plans before follow-up or implementation", () => {
    const state = stateAtFirstPlanDecision();
    expect(activeQuestionId(state)).toBe("terminal-plan");
    const revised = promptPlanInteractionFixture(state, "Ändra planen.");
    expect(activeQuestionId(revised)).toBe("question-followup");
    const secondPlan = stateAtSecondPlanDecision();
    expect(activeQuestionId(secondPlan)).toBe("terminal-plan");
  });

  it("leaves plan mode when implement plan is submitted", () => {
    const state = promptPlanInteractionFixture(
      stateAtSecondPlanDecision(),
      IMPLEMENT_PLAN_USER_MESSAGE,
    );
    expect(state.collaborationMode).toBe("default");
    expect(activeQuestionId(state)).toBeNull();
  });
});

describe("session composer boundary", () => {
  it("does not import or own plan interaction mock or fixture data", () => {
    const dir = join(process.cwd(), "src/features/session-composer");
    const files = readdirSync(dir).filter(
      (entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"),
    );
    expect(files.some((entry) => /mock|fixture/i.test(entry))).toBe(false);
    const joinedContents = files
      .map((entry) => readFileSync(join(dir, entry), "utf8"))
      .join("\n");
    expect(/mock|fixture|PlanInteractionMock/.test(joinedContents)).toBe(false);
  });
});
