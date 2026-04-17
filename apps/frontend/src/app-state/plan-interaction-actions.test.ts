import { describe, expect, it } from "vitest";
import { createPlanInteractionActions } from "./plan-interaction-actions";
import {
  ANSWER_OTHER_OPTION_ID,
  IMPLEMENT_PLAN_OPTION_ID,
  IMPLEMENT_PLAN_USER_MESSAGE,
} from "./plan-interaction-types";
import type {
  PlanInteractionCard,
  PlanInteractionRuntimePort,
  SessionComposerPlanInteractionActions,
} from "./plan-interaction-types";
import { createInitialLocalState } from "./plan-interaction-controller";
import type { PlanInteractionLocalState } from "./plan-interaction-controller";

interface ActionHarness {
  actions: SessionComposerPlanInteractionActions;
  calls: string[];
}

interface ActionHarnessArgs {
  afterSetCollaborationMode?: (value: string) => Promise<void>;
  otherText?: string;
  selectedOptionId?: string | null;
}

function terminalDecisionCard(): PlanInteractionCard {
  return {
    interactionId: "terminal-plan:item-plan",
    kind: "terminal_decision",
    options: [
      {
        kind: "choice",
        label: "Yes, implement this plan",
        optionId: IMPLEMENT_PLAN_OPTION_ID,
      },
      {
        kind: "other",
        label: "No, and tell Codex what to do differently",
        optionId: ANSWER_OTHER_OPTION_ID,
      },
    ],
    prompt: "Implement this plan?",
    questionId: "terminal-plan",
    stepLabel: null,
    submitLabel: "Submit",
    title: "Plan Decision",
  };
}

async function waitOneTick(): Promise<void> {
  await Promise.resolve();
}

async function waitForAction(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function initialHarnessState(
  card: PlanInteractionCard,
  args: ActionHarnessArgs,
): PlanInteractionLocalState {
  return Object.assign(createInitialLocalState(), {
    interactionId: card.interactionId,
    otherText: args.otherText ?? "",
    selectedOptionId: args.selectedOptionId ?? null,
  });
}

function actionHarness(args: ActionHarnessArgs): ActionHarness {
  const card = terminalDecisionCard();
  const calls: string[] = [];
  let state = initialHarnessState(card, args);
  const port: PlanInteractionRuntimePort = {
    collaborationMode: "plan",
    enabled: true,
    history: null,
    lastResolution: null,
    openSessionId: "open-session-1",
    promptSession: async (text) => {
      calls.push(`prompt:${text}`);
      await Promise.resolve();
    },
    respondInteraction: async () => {
      calls.push("respond");
      await Promise.resolve();
    },
    setCollaborationMode: async (value) => {
      calls.push(`set:${value}`);
      await args.afterSetCollaborationMode?.(value);
    },
  };
  const actions = createPlanInteractionActions({
    card,
    port,
    selectOption: (optionId) => {
      calls.push(`select:${optionId}`);
    },
    setOtherText: (text) => {
      calls.push(`text:${text}`);
    },
    setState: (next) => {
      if (typeof next === "function") {
        state = next(state);
        return;
      }
      state = next;
    },
    state,
  });
  return { actions, calls };
}

describe("plan interaction terminal actions", () => {
  it("sets default collaboration mode before sending implement plan", async () => {
    const harness = actionHarness({
      afterSetCollaborationMode: async () => {
        await waitForAction();
      },
    });

    harness.actions.submitChoice(IMPLEMENT_PLAN_OPTION_ID);
    await waitOneTick();
    expect(harness.calls).toEqual(["set:default"]);
    await waitForAction();
    expect(harness.calls).toEqual([
      "set:default",
      `prompt:${IMPLEMENT_PLAN_USER_MESSAGE}`,
    ]);
  });

  it("does not implement when exiting plan mode fails", async () => {
    const harness = actionHarness({
      afterSetCollaborationMode: async () => {
        await Promise.resolve();
        throw new Error("mode switch failed");
      },
    });

    harness.actions.submitChoice(IMPLEMENT_PLAN_OPTION_ID);
    await waitForAction();
    expect(harness.calls).toEqual(["set:default"]);
  });

  it("does not dismiss terminal decisions", async () => {
    const harness = actionHarness({});

    harness.actions.dismissInteraction();
    await waitForAction();
    expect(harness.calls).toEqual([]);
  });

  it("continues terminal discussion without changing mode", async () => {
    const harness = actionHarness({
      otherText: "Revise the plan",
      selectedOptionId: ANSWER_OTHER_OPTION_ID,
    });

    harness.actions.submitInteraction();
    await waitForAction();
    expect(harness.calls).toEqual(["prompt:Revise the plan"]);
  });
});
