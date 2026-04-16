type PlanInteractionOptionKind = "choice" | "other";

interface PlanInteractionMockOption {
  kind: PlanInteractionOptionKind;
  label: string;
  optionId: string;
}

interface PlanInteractionMockCard {
  interactionId: string;
  options: readonly PlanInteractionMockOption[];
  prompt: string;
  questionId: string;
  stepLabel: string | null;
  submitLabel: string;
  title: string;
}

interface PlanInteractionMockScenario {
  cards: readonly PlanInteractionMockCard[];
  description: string;
  id: string;
  label: string;
}

const PLAN_INTERACTION_MOCK_SCENARIOS: readonly PlanInteractionMockScenario[] = [
  {
    cards: [
      {
        interactionId: "mock-clarify-1",
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
      {
        interactionId: "mock-clarify-2",
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
    ],
    description: "Två sekventiella frågor med 3 val + Other.",
    id: "two-questions",
    label: "Mock: två frågor",
  },
  {
    cards: [
      {
        interactionId: "mock-implement-1",
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
    ],
    description: "Terminalt beslut: implementera eller stanna i plan-läge.",
    id: "implement-decision",
    label: "Mock: implement-beslut",
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
  PlanInteractionMockOption,
  PlanInteractionMockScenario,
};
