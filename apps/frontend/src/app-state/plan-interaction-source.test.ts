import { expect, it, vi } from "vitest";
import { promptLivePlanInteractionSession } from "./plan-interaction-prompt";
import type {
  PromptLivePlanInteractionSessionArgs,
  PromptTurnDispatch,
} from "./plan-interaction-prompt";
import {
  sessionPromptTurnFinished,
  sessionPromptTurnStarted,
} from "./session-prompt-turns";
import type { ActiveSession } from "./session-selection";

type PromptSession = PromptLivePlanInteractionSessionArgs["promptSession"];

function openActiveSession(): Extract<ActiveSession, { kind: "open" }> {
  return {
    configOptions: null,
    configSyncBlocked: false,
    configSyncError: null,
    cwd: "/tmp/project",
    kind: "open",
    modes: null,
    models: null,
    openSessionId: "open-session-1",
    provider: "codex",
    sessionId: "session-1",
    title: null,
  };
}

function promptSessionRecording(calls: string[]): PromptSession {
  return vi.fn<PromptSession>((request) => ({
    unwrap: vi.fn<() => Promise<void>>(async () => {
      await Promise.resolve();
      calls.push(`prompt:${request.openSessionId}`);
    }),
  }));
}

it("tracks live plan interaction prompts with the prompt turn lifecycle", async () => {
  const calls: string[] = [];
  const activeSession = openActiveSession();
  const promptSession = promptSessionRecording(calls);
  const dispatch = vi.fn<PromptTurnDispatch>((action) => {
    calls.push(action.type);
    return action;
  });

  await promptLivePlanInteractionSession({
    activeSession,
    dispatch,
    enabled: true,
    openSessionId: activeSession.openSessionId,
    promptSession,
    text: "Implement plan",
  });

  expect(promptSession).toHaveBeenCalledWith({
    openSessionId: "open-session-1",
    prompt: [{ text: "Implement plan", type: "text" }],
  });
  expect(dispatch).toHaveBeenNthCalledWith(
    1,
    sessionPromptTurnStarted({ provider: "codex", sessionId: "session-1" }),
  );
  expect(dispatch).toHaveBeenNthCalledWith(
    2,
    sessionPromptTurnFinished({ provider: "codex", sessionId: "session-1" }),
  );
  expect(calls).toEqual([
    "sessionPromptTurns/sessionPromptTurnStarted",
    "prompt:open-session-1",
    "sessionPromptTurns/sessionPromptTurnFinished",
  ]);
});

it("does not prompt from an inactive live plan interaction port", async () => {
  const calls: string[] = [];
  const promptSession = promptSessionRecording(calls);
  const dispatch = vi.fn<PromptTurnDispatch>();

  await promptLivePlanInteractionSession({
    activeSession: openActiveSession(),
    dispatch,
    enabled: false,
    openSessionId: "open-session-1",
    promptSession,
    text: "Implement plan",
  });

  expect(promptSession).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
});
