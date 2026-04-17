import { expect, it, vi } from "vitest";
import { promptTrackedOpenSession } from "./session-prompt-turn-command";
import type { SessionPromptTurnIdentity } from "./session-prompt-turns";

type PromptTrackedOpenSessionArgs = Parameters<
  typeof promptTrackedOpenSession
>[0];
type PromptSession = PromptTrackedOpenSessionArgs["promptSession"];
type PromptTurnCallback = NonNullable<
  PromptTrackedOpenSessionArgs["onPromptTurnStarted"]
>;

function promptTurnIdentity(): SessionPromptTurnIdentity {
  return {
    provider: "codex",
    sessionId: "session-1",
  };
}

function promptSessionRecording(calls: string[]): PromptSession {
  const unwrap = vi.fn<() => Promise<void>>(async () => {
    await Promise.resolve();
    calls.push("prompt");
  });
  return vi.fn<PromptSession>(() => ({ unwrap }));
}

function expectPromptSessionRequest(promptSession: PromptSession): void {
  expect(promptSession).toHaveBeenCalledWith({
    openSessionId: "open-session-1",
    prompt: [{ text: "asasas", type: "text" }],
  });
}

function expectPromptTurnCallbacks(args: {
  identity: SessionPromptTurnIdentity;
  onPromptTurnFinished: PromptTurnCallback;
  onPromptTurnStarted: PromptTurnCallback;
}): void {
  expect(args.onPromptTurnStarted).toHaveBeenCalledWith(args.identity);
  expect(args.onPromptTurnFinished).toHaveBeenCalledWith(args.identity);
}

it("wraps an open-session prompt with prompt turn callbacks", async () => {
  const identity = promptTurnIdentity();
  const calls: string[] = [];
  const promptSession = promptSessionRecording(calls);
  const onPromptTurnStarted = vi.fn<PromptTurnCallback>((startedIdentity) => {
    calls.push(`start:${startedIdentity.sessionId}`);
  });
  const onPromptTurnFinished = vi.fn<PromptTurnCallback>((finishedIdentity) => {
    calls.push(`finish:${finishedIdentity.sessionId}`);
  });

  await promptTrackedOpenSession({
    identity,
    onPromptTurnFinished,
    onPromptTurnStarted,
    openSessionId: "open-session-1",
    promptSession,
    text: "asasas",
  });

  expectPromptSessionRequest(promptSession);
  expectPromptTurnCallbacks({
    identity,
    onPromptTurnFinished,
    onPromptTurnStarted,
  });
  expect(calls).toEqual(["start:session-1", "prompt", "finish:session-1"]);
});

it("finishes the prompt turn when the prompt mutation rejects", async () => {
  const identity = promptTurnIdentity();
  const error = new Error("prompt failed");
  const promptSession = vi.fn<PromptSession>(() => ({
    unwrap: vi.fn<() => Promise<never>>(async () => {
      await Promise.resolve();
      throw error;
    }),
  }));
  const onPromptTurnFinished = vi.fn<PromptTurnCallback>();

  await expect(
    promptTrackedOpenSession({
      identity,
      onPromptTurnFinished,
      onPromptTurnStarted: vi.fn<PromptTurnCallback>(),
      openSessionId: "open-session-1",
      promptSession,
      text: "asasas",
    }),
  ).rejects.toThrow(error);

  expect(onPromptTurnFinished).toHaveBeenCalledWith(identity);
});
