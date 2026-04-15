import {
  isGlobalSettingsUpdateRequest,
  isSessionGroupsQuery,
  isSessionHistoryRequest,
  isSessionOpenRequest,
  isSessionPromptRequest,
  isSessionSetConfigOptionRequest,
} from "./commandParams.js";
import {
  isProjectCommandName,
  projectCommandFactories,
} from "./projectCommandFactories.js";
import { ConsumerCommandSchema } from "./wire.js";
import type { ProjectCommandName } from "./projectCommandFactories.js";
import type { ProviderId } from "@conduit/session-model";
import type {
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  GlobalCommandTarget,
  SessionGroupsCommandTarget,
} from "./wire.js";

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

function requireGlobalProvider(
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
): GlobalCommandTarget {
  if (provider !== "all") {
    throw new Error(`${command} must target provider "all"`);
  }
  return provider;
}

function parseConsumerCommand(command: unknown): ConsumerCommand {
  return ConsumerCommandSchema.parse(command);
}

function createSessionGroupsCommand(
  id: string,
  provider: SessionGroupsCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionGroupsQuery(params)) {
    throw new Error("sessions/grouped params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "sessions/grouped",
    provider,
    params,
  });
}

function createSessionOpenCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionOpenRequest(params)) {
    throw new Error("session/open params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "session/open",
    provider: requireProvider("session/open", provider),
    params,
  });
}

function createSettingsGetCommand(
  id: string,
  provider: ConsumerCommandTarget,
  _params: unknown,
): ConsumerCommand {
  return parseConsumerCommand({
    id,
    command: "settings/get",
    provider: requireGlobalProvider("settings/get", provider),
    params: {},
  });
}

function createSettingsUpdateCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isGlobalSettingsUpdateRequest(params)) {
    throw new Error("settings/update params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "settings/update",
    provider: requireGlobalProvider("settings/update", provider),
    params,
  });
}

function createSessionsWatchCommand(
  id: string,
  provider: ConsumerCommandTarget,
): ConsumerCommand {
  return parseConsumerCommand({
    id,
    command: "sessions/watch",
    provider: requireGlobalProvider("sessions/watch", provider),
    params: {},
  });
}

function createProvidersConfigSnapshotCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  const validEmptyParams =
    params !== null &&
    typeof params === "object" &&
    !Array.isArray(params) &&
    Object.keys(params).length === 0;
  if (!validEmptyParams) {
    throw new Error("providers/config_snapshot params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "providers/config_snapshot",
    provider: requireGlobalProvider("providers/config_snapshot", provider),
    params: {},
  });
}

function createSessionHistoryCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionHistoryRequest(params)) {
    throw new Error("session/history params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "session/history",
    provider: requireGlobalProvider("session/history", provider),
    params,
  });
}

function createSessionWatchCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionHistoryRequest(params)) {
    throw new Error("session/watch params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "session/watch",
    provider: requireGlobalProvider("session/watch", provider),
    params,
  });
}

function createSessionPromptCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionPromptRequest(params)) {
    throw new Error("session/prompt params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "session/prompt",
    provider: requireGlobalProvider("session/prompt", provider),
    params,
  });
}

function createSessionSetConfigOptionCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionSetConfigOptionRequest(params)) {
    throw new Error("session/set_config_option params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "session/set_config_option",
    provider: requireProvider("session/set_config_option", provider),
    params,
  });
}

type ConduitFactory = (
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
) => ConsumerCommand;
type KnownConduitCommandName =
  | ProjectCommandName
  | "settings/get"
  | "settings/update"
  | "sessions/grouped"
  | "sessions/watch"
  | "providers/config_snapshot"
  | "session/open"
  | "session/set_config_option"
  | "session/history"
  | "session/watch"
  | "session/prompt";
type NonProjectConduitCommandName = Exclude<
  KnownConduitCommandName,
  ProjectCommandName
>;

const conduitFactories: Record<NonProjectConduitCommandName, ConduitFactory> = {
  "settings/get": createSettingsGetCommand,
  "settings/update": createSettingsUpdateCommand,
  "providers/config_snapshot": createProvidersConfigSnapshotCommand,
  "session/history": createSessionHistoryCommand,
  "session/open": createSessionOpenCommand,
  "session/set_config_option": createSessionSetConfigOptionCommand,
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
  command: ConsumerCommandName,
  provider: ConsumerCommandTarget,
  params: Record<string, unknown> = {},
): ConsumerCommand {
  const id = nextConsumerCommandId();
  if (isKnownConduitCommandName(command)) {
    if (isProjectCommandName(command)) {
      const globalProvider = requireGlobalProvider(command, provider);
      return parseConsumerCommand(
        projectCommandFactories[command](id, globalProvider, params),
      );
    }
    return parseConsumerCommand(
      conduitFactories[command](id, provider, params),
    );
  }
  return parseConsumerCommand({
    id,
    command,
    provider: requireProvider(command, provider),
    params: toRecordParams(params),
  });
}

export { createConsumerCommand };
