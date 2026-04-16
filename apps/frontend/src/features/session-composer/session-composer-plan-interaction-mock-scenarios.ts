import { PRODUCT_FLOW_PLAN_MODE_MOCK_SCENARIO } from "./session-composer-plan-interaction-mock-product-flow";

type PlanInteractionOptionKind = "choice" | "other";
type PlanInteractionMockCardKind = "question" | "terminal_decision";

interface PlanInteractionMockOption {
  kind: PlanInteractionOptionKind;
  label: string;
  optionId: string;
}

interface PlanInteractionMockCard {
  interactionId: string;
  kind: PlanInteractionMockCardKind;
  options: readonly PlanInteractionMockOption[];
  prompt: string;
  questionId: string;
  stepLabel: string | null;
  submitLabel: string;
  title: string;
}

type PlanInteractionMockStep =
  | {
      card: PlanInteractionMockCard;
      kind: "interaction";
    }
  | {
      id: string;
      kind: "agent_plan";
      markdown: string;
    };

interface PlanInteractionMockScenario {
  description: string;
  id: string;
  label: string;
  steps: readonly PlanInteractionMockStep[];
}

const PLAN_INTERACTION_MOCK_SCENARIOS: readonly PlanInteractionMockScenario[] = [
  PRODUCT_FLOW_PLAN_MODE_MOCK_SCENARIO,
  {
    description: "Två sekventiella frågor med 3 val + Other.",
    id: "two-questions",
    label: "Mock: två frågor",
    steps: [
      {
        card: {
          interactionId: "mock-clarify-1",
          kind: "question",
          options: [
            {
              kind: "choice",
              label: "Vardag (Recommended)",
              optionId: "theme-everyday",
            },
            { kind: "choice", label: "Absurt", optionId: "theme-absurd" },
            { kind: "choice", label: "Teknik", optionId: "theme-technical" },
            {
              kind: "other",
              label: "No, and tell Codex what to do differently",
              optionId: "answer-other",
            },
          ],
          prompt: "Vilket tema ska den lilla planen ha?",
          questionId: "question-theme",
          stepLabel: "1 of 2",
          submitLabel: "Continue",
          title: "Plan Scope",
        },
        kind: "interaction",
      },
      {
        card: {
          interactionId: "mock-clarify-2",
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
              kind: "choice",
              label: "Extra kort svar",
              optionId: "scope-compact",
            },
            {
              kind: "other",
              label: "No, and tell Codex what to do differently",
              optionId: "answer-other",
            },
          ],
          prompt: "Hur detaljerad ska planen vara?",
          questionId: "question-detail-level",
          stepLabel: "2 of 2",
          submitLabel: "Continue",
          title: "Detail Level",
        },
        kind: "interaction",
      },
    ],
  },
  {
    description: "Terminalt beslut: implementera eller stanna i plan-läge.",
    id: "implement-decision",
    label: "Mock: implement-beslut",
    steps: [
      {
        card: {
          interactionId: "mock-implement-1",
          kind: "terminal_decision",
          options: [
            {
              kind: "choice",
              label: "Yes, implement this plan",
              optionId: "implement-now",
            },
            {
              kind: "other",
              label: "No, and tell Codex what to do differently",
              optionId: "answer-other",
            },
          ],
          prompt: "Implement this plan?",
          questionId: "question-implement",
          stepLabel: null,
          submitLabel: "Submit",
          title: "Plan Decision",
        },
        kind: "interaction",
      },
    ],
  },
] as const;

function resolvePlanInteractionMockScenario(
  scenarioId: string | null,
): PlanInteractionMockScenario | null {
  if (scenarioId === null) {
    return null;
  }
  return (
    PLAN_INTERACTION_MOCK_SCENARIOS.find((scenario) => scenario.id === scenarioId) ??
    null
  );
}

export { PLAN_INTERACTION_MOCK_SCENARIOS, resolvePlanInteractionMockScenario };
export type {
  PlanInteractionMockCard,
  PlanInteractionMockCardKind,
  PlanInteractionMockOption,
  PlanInteractionMockScenario,
  PlanInteractionMockStep,
};
