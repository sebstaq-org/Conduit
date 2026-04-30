import type { SessionNewResult } from "@conduit/session-client";
import { expect, it, vi } from "vitest";
import { submitPrompt } from "./session-commands";
import type { ActiveSession } from "./session-selection";

type SubmitPromptArgs = Parameters<typeof submitPrompt>[0];
type NewSessionTrigger = SubmitPromptArgs["newSession"];
type PromptSubmittedCallback = NonNullable<
  SubmitPromptArgs["onPromptSubmitted"]
>;
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
      items: [
        {
          content: [{ text: "new", type: "text" }],
          id: "draft-initial-item",
          kind: "message",
          role: "agent",
        },
      ],
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

function promptSubmittedRecording(calls: string[]): PromptSubmittedCallback {
  return (submitted): void => {
    calls.push(
      `submitted:${submitted.openSessionId}:${submitted.baseRevision}:${submitted.baseLastItemId}:${submitted.text}`,
    );
  };
}

it("tracks an open-session prompt and clears the draft immediately", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: openActiveSession(),
    newSession: unexpectedNewSession(),
    openSessionBase: { lastItemId: "open-last-item", revision: 7 },
    onFailure: failureRecording(calls),
    onPromptSubmitted: promptSubmittedRecording(calls),
    onPromptTurnFinished: promptTurnFinishedRecording(calls),
    onPromptTurnStarted: promptTurnStartedRecording(calls),
    openSession: unexpectedOpenSession(),
    promptSession: promptSessionRecording({ calls }),
    setDraft: setDraftRecording(calls),
    setSessionConfigOption: unexpectedSetSessionConfigOption(),
    text: "asasas",
  });

  expect(calls).toEqual([
    "submitted:open-session-1:7:open-last-item:asasas",
    "draft:",
    "start:codex:session-1",
    "prompt:open-session-1",
    "finish:codex:session-1",
  ]);
});

it("keeps the submitted draft cleared after open-session prompt failure", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: openActiveSession(),
    newSession: unexpectedNewSession(),
    openSessionBase: { lastItemId: "open-last-item", revision: 7 },
    onFailure: failureRecording(calls),
    onPromptSubmitted: promptSubmittedRecording(calls),
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
    "submitted:open-session-1:7:open-last-item:asasas",
    "draft:",
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
    openSessionBase: null,
    onDraftPromptCommitted: (session) => {
      calls.push(`commit:${session.sessionId}`);
    },
    onFailure: failureRecording(calls),
    onPromptSubmitted: promptSubmittedRecording(calls),
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
    "commit:draft-session-1",
    "submitted:draft-open-session-1:0:draft-initial-item:asasas",
    "draft:",
    "start:codex:draft-session-1",
    "prompt:draft-open-session-1",
    "finish:codex:draft-session-1",
  ]);
});

it("keeps the submitted draft cleared after draft prompt failure", async () => {
  const calls: string[] = [];

  await submitPrompt({
    activeSession: draftActiveSession(),
    newSession: newSessionRecording(calls),
    openSessionBase: null,
    onDraftPromptCommitted: (session) => {
      calls.push(`commit:${session.sessionId}`);
    },
    onFailure: failureRecording(calls),
    onPromptSubmitted: promptSubmittedRecording(calls),
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
    "commit:draft-session-1",
    "submitted:draft-open-session-1:0:draft-initial-item:asasas",
    "draft:",
    "start:codex:draft-session-1",
    "prompt:draft-open-session-1",
    "finish:codex:draft-session-1",
    "failure:asasas",
  ]);
});
