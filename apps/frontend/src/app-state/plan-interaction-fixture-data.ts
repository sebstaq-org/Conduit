import type { PlanInteractionCard } from "./plan-interaction-types";

type PlanInteractionFixtureStep =
  | {
      card: PlanInteractionCard;
      kind: "interaction";
    }
  | {
      kind: "agent_plan";
      markdown: string;
    };

interface PlanInteractionFixtureScenario {
  id: string;
  label: string;
  steps: readonly PlanInteractionFixtureStep[];
}

const PRODUCT_FLOW_PLAN_MODE_FIXTURE: PlanInteractionFixtureScenario = {
  id: "product-flow",
  label: "Product flow",
  steps: [
    {
      card: {
        interactionId: "fixture-clarify-1",
        kind: "question",
        options: [
          {
            kind: "choice",
            label: "Vardag (Recommended)",
            optionId: "theme-everyday",
          },
          { kind: "choice", label: "Arbete", optionId: "theme-work" },
          {
            kind: "other",
            label: "No, and tell Codex what to do differently",
            optionId: "answer-other",
          },
        ],
        prompt: "Vilket tema ska den lilla planen ha?",
        questionId: "question-theme",
        stepLabel: "Question 1 of 2",
        submitLabel: "Continue",
        title: "Theme",
      },
      kind: "interaction",
    },
    {
      card: {
        interactionId: "fixture-clarify-2",
        kind: "question",
        options: [
          {
            kind: "choice",
            label: "3 konkreta steg",
            optionId: "scope-three-steps",
          },
          {
            kind: "choice",
            label: "Kort checklista",
            optionId: "scope-checklist",
          },
          {
            kind: "other",
            label: "No, and tell Codex what to do differently",
            optionId: "answer-other",
          },
        ],
        prompt: "Hur detaljerad ska planen vara?",
        questionId: "question-detail-level",
        stepLabel: "Question 2 of 2",
        submitLabel: "Continue",
        title: "Detail level",
      },
      kind: "interaction",
    },
    {
      kind: "agent_plan",
      markdown: [
        "## Proposed plan",
        "1. Starta med en liten vardagsrutin.",
        "2. Bryt arbetet i tre konkreta steg.",
        "3. Avsluta med en enkel kontroll.",
      ].join("\n"),
    },
    {
      card: {
        interactionId: "fixture-followup-1",
        kind: "question",
        options: [
          { kind: "choice", label: "Keep it narrow", optionId: "scope-narrow" },
          {
            kind: "choice",
            label: "Make it more detailed",
            optionId: "scope-detailed",
          },
          {
            kind: "other",
            label: "No, and tell Codex what to do differently",
            optionId: "answer-other",
          },
        ],
        prompt: "Vad ska ändras innan planen är redo?",
        questionId: "question-followup",
        stepLabel: "Follow-up",
        submitLabel: "Continue",
        title: "Revise plan",
      },
      kind: "interaction",
    },
    {
      kind: "agent_plan",
      markdown: [
        "## Proposed plan",
        "1. Håll planen smal.",
        "2. Byt ut det användaren ville ändra.",
        "3. Implementera när användaren väljer det.",
      ].join("\n"),
    },
  ],
};

function resolvePlanInteractionFixtureScenario(
  scenarioId: string | null,
): PlanInteractionFixtureScenario | null {
  if (scenarioId === PRODUCT_FLOW_PLAN_MODE_FIXTURE.id) {
    return PRODUCT_FLOW_PLAN_MODE_FIXTURE;
  }
  return null;
}

export {
  PRODUCT_FLOW_PLAN_MODE_FIXTURE,
  resolvePlanInteractionFixtureScenario,
};
export type { PlanInteractionFixtureScenario, PlanInteractionFixtureStep };
