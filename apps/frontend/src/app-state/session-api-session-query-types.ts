import type {
  ContentBlock,
  ProviderId,
  SessionSetConfigOptionResult,
} from "@conduit/session-client";

interface OpenSessionMutationArg {
  provider: ProviderId;
  sessionId: string;
  cwd: string;
  title: string | null;
  limit?: number;
}

interface NewSessionMutationArg {
  provider: ProviderId;
  cwd: string;
  limit?: number;
}

interface ReadSessionHistoryQueryArg {
  openSessionId: string;
  cursor?: string | null;
  limit?: number;
}

interface PromptSessionMutationArg {
  cancelAfterMs?: number;
  openSessionId: string;
  prompt: ContentBlock[];
}

const SESSION_PROMPT_CANCEL_AFTER_MS = 45 * 60 * 1000;

interface SetSessionConfigOptionMutationArg {
  provider: ProviderId;
  sessionId: string;
  configId: string;
  value: string;
}

export type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  PromptSessionMutationArg,
  ReadSessionHistoryQueryArg,
  SetSessionConfigOptionMutationArg,
  SessionSetConfigOptionResult,
};

export { SESSION_PROMPT_CANCEL_AFTER_MS };
