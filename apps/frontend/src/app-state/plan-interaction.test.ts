/* eslint-disable import/no-nodejs-modules, vitest/prefer-strict-boolean-matchers, vitest/prefer-to-be-falsy */

import { describe, expect, it } from "vitest";
import type { TranscriptItem } from "@conduit/session-client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IMPLEMENT_PLAN_USER_MESSAGE } from "./plan-interaction-types";
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

function siblingInteractionQuestion(
  interactionId: string,
  questionId: string,
): TranscriptItem {
  return {
    data: {
      interactionId,
      isOther: true,
      options: [
        { kind: "allow_once", name: "A", optionId: "answer-0" },
        { kind: "reject_once", name: "Cancel", optionId: "cancel" },
      ],
      question: questionId,
      questionHeader: "Question",
      questionId,
      rawInput: {
        question: {
          header: "Question",
          id: questionId,
          isOther: true,
          question: questionId,
        },
      },
      requestType: "request_user_input",
      sessionUpdate: "interaction_request",
      status: "pending",
      toolCallId: "tool-call-1",
    },
    id: interactionId,
    kind: "event",
    source: "provider",
    variant: "interaction_request",
  };
}

function siblingInteractionResolution(): TranscriptItem {
  return {
    data: {
      interactionId: "interaction-1",
      rawOutput: null,
      sessionUpdate: "interaction_resolution",
      status: "resolved",
      toolCallId: "tool-call-1",
    },
    id: "interaction-resolution-1",
    kind: "event",
    source: "provider",
    variant: "interaction_resolution",
  };
}

function terminalPlanEvent(): TranscriptItem {
  return {
    data: {
      interactionId: "terminal-plan:item-plan",
      itemId: "item-plan",
      planText: "# Plan\n",
      providerSource: "TurnItem::Plan",
      sessionUpdate: "terminal_plan",
      source: "codex.terminalPlan",
      status: "pending",
      threadId: "thread-1",
    },
    id: "terminal-plan-event",
    kind: "event",
    source: "conduit",
    variant: "terminal_plan",
  };
}

function proposedPlanMessage(): TranscriptItem {
  return {
    content: [{ text: "<proposed_plan># Plan</proposed_plan>", type: "text" }],
    id: "agent-plan-message",
    kind: "message",
    role: "agent",
    status: "complete",
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
});

describe("plan interaction projection", () => {
  it("closes sibling questions from the same provider request", () => {
    const questions = [
      siblingInteractionQuestion("interaction-1", "question-one"),
      siblingInteractionQuestion("interaction-2", "question-two"),
    ];

    expect(activePlanInteractionCard({ items: questions })?.questionId).toBe(
      "question-two",
    );
    expect(
      activePlanInteractionCard({
        items: [...questions, siblingInteractionResolution()],
      }),
    ).toBeNull();
  });

  it("opens terminal decision from normalized terminal plan events", () => {
    const card = activePlanInteractionCard({ items: [terminalPlanEvent()] });

    expect(card?.kind).toBe("terminal_decision");
    expect(card?.interactionId).toBe("terminal-plan:item-plan");
    expect(card?.questionId).toBe("terminal-plan");
  });

  it("does not infer terminal decisions from proposed-plan markdown", () => {
    expect(
      activePlanInteractionCard({ items: [proposedPlanMessage()] }),
    ).toBeNull();
  });

  it("hides terminal decision after the user continues the turn", () => {
    expect(
      activePlanInteractionCard({
        items: [
          terminalPlanEvent(),
          {
            content: [{ text: "Revise", type: "text" }],
            id: "user-1",
            kind: "message",
            role: "user",
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("plan interaction validation", () => {
  it("ignores malformed backend interaction events", () => {
    expect(
      activePlanInteractionCard({
        items: [
          {
            data: {
              interactionId: "interaction-1",
              sessionUpdate: "interaction_request",
              status: "pending",
            },
            id: "malformed-interaction",
            kind: "event",
            source: "provider",
            variant: "interaction_request",
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("plan interaction fixture decisions", () => {
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
