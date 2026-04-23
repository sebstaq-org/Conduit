/* eslint-disable vitest/prefer-strict-boolean-matchers, vitest/prefer-to-be-truthy */

import { expect, it } from "vitest";
import {
  selectSessionPromptTurnStreaming,
  sessionPromptTurnFinished,
  sessionPromptTurnStarted,
  sessionPromptTurnsReducer,
} from "./session-prompt-turns";

it("tracks streaming status per provider session", () => {
  const started = sessionPromptTurnsReducer(
    undefined,
    sessionPromptTurnStarted({
      provider: "codex",
      sessionId: "session-1",
    }),
  );

  expect(started.activeCountByProvider.codex?.["session-1"]).toBe(1);
  expect(started.activeCountByProvider.claude?.["session-1"]).toBeUndefined();
});

it("clears only the matching provider session", () => {
  let twoSessions = sessionPromptTurnsReducer(
    undefined,
    sessionPromptTurnStarted({
      provider: "codex" as const,
      sessionId: "session-1",
    }),
  );
  twoSessions = sessionPromptTurnsReducer(
    twoSessions,
    sessionPromptTurnStarted({
      provider: "codex" as const,
      sessionId: "session-2",
    }),
  );

  const finished = sessionPromptTurnsReducer(
    twoSessions,
    sessionPromptTurnFinished({
      provider: "codex",
      sessionId: "session-1",
    }),
  );

  expect(finished.activeCountByProvider.codex?.["session-1"]).toBeUndefined();
  expect(finished.activeCountByProvider.codex?.["session-2"]).toBe(1);
});

it("keeps streaming until every matching prompt turn has finished", () => {
  let twoTurns = sessionPromptTurnsReducer(
    undefined,
    sessionPromptTurnStarted({
      provider: "codex",
      sessionId: "session-1",
    }),
  );
  twoTurns = sessionPromptTurnsReducer(
    twoTurns,
    sessionPromptTurnStarted({
      provider: "codex",
      sessionId: "session-1",
    }),
  );

  const onceFinished = sessionPromptTurnsReducer(
    twoTurns,
    sessionPromptTurnFinished({
      provider: "codex",
      sessionId: "session-1",
    }),
  );
  const twiceFinished = sessionPromptTurnsReducer(
    onceFinished,
    sessionPromptTurnFinished({
      provider: "codex",
      sessionId: "session-1",
    }),
  );

  expect(onceFinished.activeCountByProvider.codex?.["session-1"]).toBe(1);
  expect(
    twiceFinished.activeCountByProvider.codex?.["session-1"],
  ).toBeUndefined();
});

it("selects streaming status from the root session prompt turn state", () => {
  const promptTurns = sessionPromptTurnsReducer(
    undefined,
    sessionPromptTurnStarted({
      provider: "codex",
      sessionId: "selector-session",
    }),
  );
  const state = {
    sessionPromptTurns: promptTurns,
  } satisfies Parameters<typeof selectSessionPromptTurnStreaming>[0];

  expect(
    selectSessionPromptTurnStreaming(state, {
      provider: "codex",
      sessionId: "selector-session",
    }),
  ).toBeTruthy();
  expect(
    selectSessionPromptTurnStreaming(state, {
      provider: "codex",
      sessionId: "missing-selector-session",
    }),
  ).toBeFalsy();
});
