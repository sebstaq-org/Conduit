import {
  isSessionGroupsQuery,
  isSessionHistoryRequest,
  isSessionOpenRequest,
  isSessionPromptRequest,
} from "./commandParams.js";
import type {
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  ProviderConsumerCommand,
  ProviderScopedCommandName,
  SessionGroupsCommandName,
  SessionGroupsConsumerCommand,
  SessionGroupsQuery,
  SessionHistoryCommandName,
  SessionHistoryConsumerCommand,
  SessionHistoryRequest,
  SessionOpenCommandName,
  SessionOpenConsumerCommand,
  SessionOpenRequest,
  SessionPromptCommandName,
  SessionPromptConsumerCommand,
  SessionPromptRequest,
} from "./wire.js";
import type { ProviderId } from "@conduit/session-model";

let nextCommandSequence = 0;

function nextConsumerCommandId(): string {
  nextCommandSequence += 1;
  return `conduit-command-${String(nextCommandSequence)}`;
}

function toRecordParams(params: object): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    record[key] = value;
  }
  return record;
}

function requireProvider(
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
): ProviderId {
  if (provider === "all") {
    throw new Error(`${command} must target a provider`);
  }
  return provider;
}

function createSessionGroupsCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): SessionGroupsConsumerCommand {
  if (!isSessionGroupsQuery(params)) {
    throw new Error("sessions/grouped params are invalid");
  }
  return {
    id,
    command: "sessions/grouped",
    provider,
    params,
  };
}

function createSessionOpenCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): SessionOpenConsumerCommand {
  if (!isSessionOpenRequest(params)) {
    throw new Error("session/open params are invalid");
  }
  return {
    id,
    command: "session/open",
    provider: requireProvider("session/open", provider),
    params,
  };
}

function createSessionHistoryCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): SessionHistoryConsumerCommand {
  if (!isSessionHistoryRequest(params)) {
    throw new Error("session/history params are invalid");
  }
  return {
    id,
    command: "session/history",
    provider: requireProvider("session/history", provider),
    params,
  };
}

function createSessionPromptCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): SessionPromptConsumerCommand {
  if (!isSessionPromptRequest(params)) {
    throw new Error("session/prompt params are invalid");
  }
  return {
    id,
    command: "session/prompt",
    provider: requireProvider("session/prompt", provider),
    params,
  };
}

function createConsumerCommand(
  command: SessionGroupsCommandName,
  provider: ConsumerCommandTarget,
  params?: SessionGroupsQuery,
): SessionGroupsConsumerCommand;

function createConsumerCommand(
  command: SessionOpenCommandName,
  provider: ProviderId,
  params: SessionOpenRequest,
): SessionOpenConsumerCommand;

function createConsumerCommand(
  command: SessionHistoryCommandName,
  provider: ProviderId,
  params: SessionHistoryRequest,
): SessionHistoryConsumerCommand;

function createConsumerCommand(
  command: SessionPromptCommandName,
  provider: ProviderId,
  params: SessionPromptRequest,
): SessionPromptConsumerCommand;

function createConsumerCommand(
  command: ProviderScopedCommandName,
  provider: ProviderId,
  params?: Record<string, unknown>,
): ProviderConsumerCommand;

function createConsumerCommand(
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
  params:
    | Record<string, unknown>
    | SessionGroupsQuery
    | SessionOpenRequest
    | SessionHistoryRequest
    | SessionPromptRequest = {},
): ConsumerCommand {
  const id = nextConsumerCommandId();
  if (command === "sessions/grouped") {
    return createSessionGroupsCommand(id, provider, params);
  }
  if (command === "session/open") {
    return createSessionOpenCommand(id, provider, params);
  }
  if (command === "session/history") {
    return createSessionHistoryCommand(id, provider, params);
  }
  if (command === "session/prompt") {
    return createSessionPromptCommand(id, provider, params);
  }
  return {
    id,
    command,
    provider: requireProvider(command, provider),
    params: toRecordParams(params),
  };
}

export { createConsumerCommand };
