import type {
  PlanInteractionMockCard,
  PlanInteractionMockOption,
} from "./session-composer-plan-interaction-mock-scenarios";
import {
  PLAN_INTERACTION_MOCK_SCENARIOS,
  resolvePlanInteractionMockScenario,
} from "./session-composer-plan-interaction-mock-scenarios";

interface SessionComposerPlanInteractionMockState {
  activeCardIndex: number;
  activeScenarioId: string | null;
  lastResolution: string | null;
  mode: "interaction" | "message";
  otherText: string;
  selectedOptionId: string | null;
}

interface SessionComposerPlanInteractionMockView {
  activeCard: PlanInteractionMockCard | null;
  canSubmit: boolean;
  enabled: boolean;
  lastResolution: string | null;
  otherText: string;
  scenarios: typeof PLAN_INTERACTION_MOCK_SCENARIOS;
  selectedOptionId: string | null;
}

const PLAN_MODE_UI_MOCK_ENV = "EXPO_PUBLIC_CONDUIT_PLAN_MODE_UI_MOCK";
const PLAN_MODE_UI_MOCK_SCENARIO_ENV =
  "EXPO_PUBLIC_CONDUIT_PLAN_MODE_UI_MOCK_SCENARIO";

function createSessionComposerPlanInteractionMockState(
): SessionComposerPlanInteractionMockState {
  return {
    activeCardIndex: 0,
    activeScenarioId: null,
    lastResolution: null,
    mode: "message",
    otherText: "",
    selectedOptionId: null,
  };
}

function resolveActivePlanInteractionMockCard(
  state: SessionComposerPlanInteractionMockState,
): PlanInteractionMockCard | null {
  if (state.mode !== "interaction") {
    return null;
  }
  const scenario = resolvePlanInteractionMockScenario(state.activeScenarioId);
  if (scenario === null) {
    return null;
  }
  return scenario.cards[state.activeCardIndex] ?? null;
}

function firstSelectableOptionId(
  card: PlanInteractionMockCard | null,
): string | null {
  if (card === null) {
    return null;
  }
  return card.options[0]?.optionId ?? null;
}

function selectedOption(
  card: PlanInteractionMockCard | null,
  selectedOptionId: string | null,
): PlanInteractionMockOption | null {
  if (card === null || selectedOptionId === null) {
    return null;
  }
  return (
    card.options.find((option) => option.optionId === selectedOptionId) ?? null
  );
}

function canSubmitPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): boolean {
  const card = resolveActivePlanInteractionMockCard(state);
  const option = selectedOption(card, state.selectedOptionId);
  if (option === null) {
    return false;
  }
  if (option.kind !== "other") {
    return true;
  }
  return state.otherText.trim().length > 0;
}

function startPlanInteractionMockScenario(
  state: SessionComposerPlanInteractionMockState,
  scenarioId: string,
): SessionComposerPlanInteractionMockState {
  const scenario = resolvePlanInteractionMockScenario(scenarioId);
  if (scenario === null) {
    return state;
  }
  return {
    activeCardIndex: 0,
    activeScenarioId: scenario.id,
    lastResolution: null,
    mode: "interaction",
    otherText: "",
    selectedOptionId: firstSelectableOptionId(scenario.cards[0] ?? null),
  };
}

function dismissPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  if (state.mode !== "interaction") {
    return state;
  }
  const scenario = resolvePlanInteractionMockScenario(state.activeScenarioId);
  let lastResolution = "Mock interaction dismissed.";
  if (scenario !== null) {
    lastResolution = `Mock dismissed: ${scenario.label}`;
  }
  return {
    activeCardIndex: 0,
    activeScenarioId: null,
    lastResolution,
    mode: "message",
    otherText: "",
    selectedOptionId: null,
  };
}

function selectPlanInteractionMockOption(
  state: SessionComposerPlanInteractionMockState,
  optionId: string,
): SessionComposerPlanInteractionMockState {
  const card = resolveActivePlanInteractionMockCard(state);
  const option = selectedOption(card, optionId);
  if (option === null) {
    return state;
  }
  let otherText = "";
  if (option.kind === "other") {
    otherText = state.otherText;
  }
  return {
    activeCardIndex: state.activeCardIndex,
    activeScenarioId: state.activeScenarioId,
    lastResolution: state.lastResolution,
    mode: state.mode,
    otherText,
    selectedOptionId: option.optionId,
  };
}

function setPlanInteractionMockOtherText(
  state: SessionComposerPlanInteractionMockState,
  text: string,
): SessionComposerPlanInteractionMockState {
  return {
    activeCardIndex: state.activeCardIndex,
    activeScenarioId: state.activeScenarioId,
    lastResolution: state.lastResolution,
    mode: state.mode,
    otherText: text,
    selectedOptionId: state.selectedOptionId,
  };
}

function submitPlanInteractionMock(
  state: SessionComposerPlanInteractionMockState,
): SessionComposerPlanInteractionMockState {
  if (!canSubmitPlanInteractionMock(state)) {
    return state;
  }
  const scenario = resolvePlanInteractionMockScenario(state.activeScenarioId);
  if (scenario === null) {
    return dismissPlanInteractionMock(state);
  }
  const nextCard = scenario.cards[state.activeCardIndex + 1] ?? null;
  if (nextCard !== null) {
    return {
      activeCardIndex: state.activeCardIndex + 1,
      activeScenarioId: state.activeScenarioId,
      lastResolution: state.lastResolution,
      mode: state.mode,
      otherText: "",
      selectedOptionId: firstSelectableOptionId(nextCard),
    };
  }
  return {
    activeCardIndex: 0,
    activeScenarioId: null,
    lastResolution: `Mock completed: ${scenario.label}`,
    mode: "message",
    otherText: "",
    selectedOptionId: null,
  };
}

function readPlanModeUiMockFlag(rawValue?: string): boolean {
  if (rawValue === undefined) {
    return false;
  }
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function isPlanModeUiMockEnabled(): boolean {
  return readPlanModeUiMockFlag(process.env[PLAN_MODE_UI_MOCK_ENV]);
}

function planModeUiMockScenarioId(): string {
  const scenarioId = process.env[PLAN_MODE_UI_MOCK_SCENARIO_ENV];
  if (scenarioId === undefined || scenarioId.trim().length === 0) {
    return "two-questions";
  }
  return scenarioId;
}

function buildSessionComposerPlanInteractionMockView(args: {
  enabled: boolean;
  state: SessionComposerPlanInteractionMockState;
}): SessionComposerPlanInteractionMockView {
  if (!args.enabled) {
    return {
      activeCard: null,
      canSubmit: false,
      enabled: false,
      lastResolution: null,
      otherText: "",
      scenarios: PLAN_INTERACTION_MOCK_SCENARIOS,
      selectedOptionId: null,
    };
  }
  return {
    activeCard: resolveActivePlanInteractionMockCard(args.state),
    canSubmit: canSubmitPlanInteractionMock(args.state),
    enabled: true,
    lastResolution: args.state.lastResolution,
    otherText: args.state.otherText,
    scenarios: PLAN_INTERACTION_MOCK_SCENARIOS,
    selectedOptionId: args.state.selectedOptionId,
  };
}

export {
  PLAN_INTERACTION_MOCK_SCENARIOS,
  buildSessionComposerPlanInteractionMockView,
  canSubmitPlanInteractionMock,
  createSessionComposerPlanInteractionMockState,
  dismissPlanInteractionMock,
  isPlanModeUiMockEnabled,
  planModeUiMockScenarioId,
  readPlanModeUiMockFlag,
  resolveActivePlanInteractionMockCard,
  selectPlanInteractionMockOption,
  setPlanInteractionMockOtherText,
  startPlanInteractionMockScenario,
  submitPlanInteractionMock,
};
export type {
  SessionComposerPlanInteractionMockState,
  SessionComposerPlanInteractionMockView,
};
