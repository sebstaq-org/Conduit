import {
  isSessionGroupsQuery,
  isSessionHistoryRequest,
  isSessionOpenRequest,
  isSessionPromptRequest,
} from "./commandParams.js";
import {
  isProjectCommandName,
  projectCommandFactories,
} from "./projectCommandFactories.js";
import type {
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  ProjectAddCommandName,
  ProjectAddConsumerCommand,
  ProjectAddRequest,
  ProjectListCommandName,
  ProjectListConsumerCommand,
  ProjectRemoveCommandName,
  ProjectRemoveConsumerCommand,
  ProjectRemoveRequest,
  ProjectSuggestionsCommandName,
  ProjectSuggestionsConsumerCommand,
  ProjectSuggestionsQuery,
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
  SessionsWatchCommandName,
  SessionsWatchConsumerCommand,
  SessionWatchCommandName,
  SessionWatchConsumerCommand,
} from "./wire.js";
import type { ProjectCommandName } from "./projectCommandFactories.js";
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

function createSessionsWatchCommand(
  id: string,
  provider: ConsumerCommandTarget,
): SessionsWatchConsumerCommand {
  return {
    id,
    command: "sessions/watch",
    provider,
    params: {},
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
    provider,
    params,
  };
}

function createSessionWatchCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): SessionWatchConsumerCommand {
  if (!isSessionHistoryRequest(params)) {
    throw new Error("session/watch params are invalid");
  }
  return {
    id,
    command: "session/watch",
    provider,
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
    provider,
    params,
  };
}

type ConduitFactory = (
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
) => ConsumerCommand;

type KnownConduitCommandName =
  | ProjectCommandName
  | SessionGroupsCommandName
  | SessionsWatchCommandName
  | SessionOpenCommandName
  | SessionHistoryCommandName
  | SessionWatchCommandName
  | SessionPromptCommandName;

type NonProjectConduitCommandName = Exclude<
  KnownConduitCommandName,
  ProjectCommandName
>;

const conduitFactories: Record<NonProjectConduitCommandName, ConduitFactory> = {
  "session/history": createSessionHistoryCommand,
  "session/open": createSessionOpenCommand,
  "session/prompt": createSessionPromptCommand,
  "session/watch": createSessionWatchCommand,
  "sessions/grouped": createSessionGroupsCommand,
  "sessions/watch": createSessionsWatchCommand,
};

function isKnownConduitCommandName(
  command: ConsumerCommandName,
): command is KnownConduitCommandName {
  return isProjectCommandName(command) || command in conduitFactories;
}

function createConsumerCommand(
  command: ProjectAddCommandName,
  provider: ConsumerCommandTarget,
  params: ProjectAddRequest,
): ProjectAddConsumerCommand;

function createConsumerCommand(
  command: ProjectListCommandName,
  provider: ConsumerCommandTarget,
): ProjectListConsumerCommand;

function createConsumerCommand(
  command: ProjectRemoveCommandName,
  provider: ConsumerCommandTarget,
  params: ProjectRemoveRequest,
): ProjectRemoveConsumerCommand;

function createConsumerCommand(
  command: ProjectSuggestionsCommandName,
  provider: ConsumerCommandTarget,
  params?: ProjectSuggestionsQuery,
): ProjectSuggestionsConsumerCommand;

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
  command: SessionsWatchCommandName,
  provider: ConsumerCommandTarget,
): SessionsWatchConsumerCommand;

function createConsumerCommand(
  command: SessionHistoryCommandName,
  provider: ConsumerCommandTarget,
  params: SessionHistoryRequest,
): SessionHistoryConsumerCommand;

function createConsumerCommand(
  command: SessionWatchCommandName,
  provider: ConsumerCommandTarget,
  params: SessionHistoryRequest,
): SessionWatchConsumerCommand;

function createConsumerCommand(
  command: SessionPromptCommandName,
  provider: ConsumerCommandTarget,
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
    | ProjectAddRequest
    | ProjectRemoveRequest
    | ProjectSuggestionsQuery
    | SessionGroupsQuery
    | SessionOpenRequest
    | SessionHistoryRequest
    | SessionPromptRequest = {},
): ConsumerCommand {
  const id = nextConsumerCommandId();
  if (isKnownConduitCommandName(command)) {
    if (isProjectCommandName(command)) {
      return projectCommandFactories[command](id, provider, params);
    }
    return conduitFactories[command](id, provider, params);
  }
  return {
    id,
    command,
    provider: requireProvider(command, provider),
    params: toRecordParams(params),
  };
}

export { createConsumerCommand };
