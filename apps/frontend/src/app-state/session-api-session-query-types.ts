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
  openSessionId: string;
  prompt: ContentBlock[];
}

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
