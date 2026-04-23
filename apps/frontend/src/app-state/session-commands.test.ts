import type { SessionNewResult } from "@conduit/session-client";
import { expect, it, vi } from "vitest";
import { submitPrompt } from "./session-commands";
import type { ActiveSession } from "./session-selection";

type SubmitPromptArgs = Parameters<typeof submitPrompt>[0];
type NewSessionTrigger = SubmitPromptArgs["newSession"];
type OpenSessionTrigger = SubmitPromptArgs["openSession"];
type PromptFailureCallback = NonNullable<SubmitPromptArgs["onFailure"]>;
type PromptSessionTrigger = SubmitPromptArgs["promptSession"];
type PromptTurnCallback = NonNullable<SubmitPromptArgs["onPromptTurnStarted"]>;
type SetDraft = SubmitPromptArgs["setDraft"];
type SetSessionConfigOptionTrigger = SubmitPromptArgs["setSessionConfigOption"];

function openActiveSession(): ActiveSession {
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

function draftActiveSession(): ActiveSession {
  return {
    cwd: "/tmp/project",
    kind: "draft",
    provider: "codex",
    selectedConfigByProvider: {},
  };
}

function draftSessionResponse(): SessionNewResult {
  return {
    configOptions: null,
    history: {
      items: [],
      nextCursor: null,
      openSessionId: "draft-open-session-1",
      revision: 0,
    },
    modes: null,
    models: null,
    sessionId: "draft-session-1",
  };
}

function unexpectedNewSession(): NewSessionTrigger {
  return vi.fn<NewSessionTrigger>(() => {
    throw new Error("unexpected newSession call");
  });
}

function unexpectedOpenSession(): OpenSessionTrigger {
  return vi.fn<OpenSessionTrigger>(() => {
    throw new Error("unexpected openSession call");
  });
}

function unexpectedSetSessionConfigOption(): SetSessionConfigOptionTrigger {
  return vi.fn<SetSessionConfigOptionTrigger>(() => {
    throw new Error("unexpected setSessionConfigOption call");
  });
}

function newSessionRecording(calls: string[]): NewSessionTrigger {
  return vi.fn<NewSessionTrigger>((request) => ({
    unwrap: vi.fn<() => Promise<SessionNewResult>>(async () => {
      await Promise.resolve();
      calls.push(`new:${request.provider}`);
      return draftSessionResponse();
    }),
  }));
}

function promptSessionRecording(args: {
  calls: string[];
  error?: Error;
}): PromptSessionTrigger {
  return vi.fn<PromptSessionTrigger>((request) => ({
    unwrap: vi.fn<() => Promise<null>>(async () => {
      await Promise.resolve();
      args.calls.push(`prompt:${request.openSessionId}`);
      if (args.error !== undefined) {
        throw args.error;
      }
      return null;
    }),
  }));
}

function setDraftRecording(calls: string[]): SetDraft {
  return (draft): void => {
    calls.push(`draft:${draft}`);
  };
}

function promptTurnStartedRecording(calls: string[]): PromptTurnCallback {
  return (identity): void => {
    calls.push(`start:${identity.provider}:${identity.sessionId}`);
  };
}

function promptTurnFinishedRecording(calls: string[]): PromptTurnCallback {
  return (identity): void => {
    calls.push(`finish:${identity.provider}:${identity.sessionId}`);
  };
}

function failureRecording(calls: string[]): PromptFailureCallback {
  return (failure): void => {
    calls.push(`failure:${failure.text}`);
  };
}

it("tracks an open-session prompt and clears the draft after success", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: openActiveSession(),
    newSession: unexpectedNewSession(),
    onFailure: failureRecording(calls),
    onPromptTurnFinished: promptTurnFinishedRecording(calls),
    onPromptTurnStarted: promptTurnStartedRecording(calls),
    openSession: unexpectedOpenSession(),
    promptSession: promptSessionRecording({ calls }),
    setDraft: setDraftRecording(calls),
    setSessionConfigOption: unexpectedSetSessionConfigOption(),
    text: "asasas",
  });

  expect(calls).toEqual([
    "start:codex:session-1",
    "prompt:open-session-1",
    "finish:codex:session-1",
    "draft:",
  ]);
});

it("preserves the draft and still finishes the open-session turn after prompt failure", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: openActiveSession(),
    newSession: unexpectedNewSession(),
    onFailure: failureRecording(calls),
    onPromptTurnFinished: promptTurnFinishedRecording(calls),
    onPromptTurnStarted: promptTurnStartedRecording(calls),
    openSession: unexpectedOpenSession(),
    promptSession: promptSessionRecording({
      calls,
      error: new Error("prompt failed"),
    }),
    setDraft: setDraftRecording(calls),
    setSessionConfigOption: unexpectedSetSessionConfigOption(),
    text: "asasas",
  });

  expect(calls).toEqual([
    "start:codex:session-1",
    "prompt:open-session-1",
    "finish:codex:session-1",
    "failure:asasas",
  ]);
});

it("tracks a draft prompt, commits the opened session, and clears the draft after success", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: draftActiveSession(),
    newSession: newSessionRecording(calls),
    onDraftPromptCommitted: (session) => {
      calls.push(`commit:${session.sessionId}`);
    },
    onFailure: failureRecording(calls),
    onPromptTurnFinished: promptTurnFinishedRecording(calls),
    onPromptTurnStarted: promptTurnStartedRecording(calls),
    openSession: unexpectedOpenSession(),
    promptSession: promptSessionRecording({ calls }),
    setDraft: setDraftRecording(calls),
    setSessionConfigOption: unexpectedSetSessionConfigOption(),
    text: "asasas",
  });

  expect(calls).toEqual([
    "new:codex",
    "start:codex:draft-session-1",
    "prompt:draft-open-session-1",
    "finish:codex:draft-session-1",
    "commit:draft-session-1",
    "draft:",
  ]);
});

it("preserves an uncommitted draft and still finishes the draft turn after prompt failure", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: draftActiveSession(),
    newSession: newSessionRecording(calls),
    onDraftPromptCommitted: (session) => {
      calls.push(`commit:${session.sessionId}`);
    },
    onFailure: failureRecording(calls),
    onPromptTurnFinished: promptTurnFinishedRecording(calls),
    onPromptTurnStarted: promptTurnStartedRecording(calls),
    openSession: unexpectedOpenSession(),
    promptSession: promptSessionRecording({
      calls,
      error: new Error("prompt failed"),
    }),
    setDraft: setDraftRecording(calls),
    setSessionConfigOption: unexpectedSetSessionConfigOption(),
    text: "asasas",
  });

  expect(calls).toEqual([
    "new:codex",
    "start:codex:draft-session-1",
    "prompt:draft-open-session-1",
    "finish:codex:draft-session-1",
    "failure:asasas",
  ]);
});
