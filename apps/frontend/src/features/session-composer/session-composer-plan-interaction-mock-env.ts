import {
  PLAN_MODE_UI_MOCK_ENV,
  PLAN_MODE_UI_MOCK_SCENARIO_ENV,
} from "./session-composer-plan-interaction-mock-model";

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
    return "product-flow";
  }
  return scenarioId;
}

export {
  isPlanModeUiMockEnabled,
  planModeUiMockScenarioId,
  readPlanModeUiMockFlag,
};
