import type { PlanInteractionMockScenario } from "./session-composer-plan-interaction-mock-scenarios";

const PRODUCT_FLOW_PLAN_MODE_MOCK_SCENARIO: PlanInteractionMockScenario = {
  description:
    "Fullt produktflöde: frågor, markdown-plan, terminalbeslut, stay, ny fråga, ny plan och implement.",
  id: "product-flow",
  label: "Mock: produktflöde",
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
          { kind: "choice", label: "Kort checklista", optionId: "scope-checklist" },
          { kind: "choice", label: "Extra kort svar", optionId: "scope-compact" },
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
    {
      id: "mock-plan-1",
      kind: "agent_plan",
      markdown:
        "<proposed_plan>\n## Proposed plan\n\n1. Skissa en liten vardagsfeature med tre konkreta steg.\n2. Lägg till den minsta säkra backend-ytan.\n3. Verifiera med en riktad UI-check innan implementation.\n</proposed_plan>",
    },
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
        questionId: "question-implement-1",
        stepLabel: null,
        submitLabel: "Submit",
        title: "Plan Decision",
      },
      kind: "interaction",
    },
    {
      card: {
        interactionId: "mock-followup-1",
        kind: "question",
        options: [
          { kind: "choice", label: "Keep it narrow", optionId: "scope-narrow" },
          {
            kind: "choice",
            label: "Add one regression test",
            optionId: "scope-test",
          },
          { kind: "choice", label: "Mention rollout risk", optionId: "scope-risk" },
          {
            kind: "other",
            label: "No, and tell Codex what to do differently",
            optionId: "answer-other",
          },
        ],
        prompt: "Vad ska ändras innan planen är redo?",
        questionId: "question-followup",
        stepLabel: "1 of 1",
        submitLabel: "Continue",
        title: "Follow-up",
      },
      kind: "interaction",
    },
    {
      id: "mock-plan-2",
      kind: "agent_plan",
      markdown:
        "<proposed_plan>\n## Proposed plan\n\n1. Behåll scopet smalt och bygg bara den minsta säkra ändringen.\n2. Lägg till en regressionstest som visar produktflödet.\n3. Kör UI-verifiering innan implementationen startas.\n</proposed_plan>",
    },
    {
      card: {
        interactionId: "mock-implement-2",
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
        questionId: "question-implement-2",
        stepLabel: null,
        submitLabel: "Submit",
        title: "Plan Decision",
      },
      kind: "interaction",
    },
  ],
};

export { PRODUCT_FLOW_PLAN_MODE_MOCK_SCENARIO };
