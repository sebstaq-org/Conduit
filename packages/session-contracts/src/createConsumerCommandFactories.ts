import {
  isGlobalSettingsUpdateRequest,
  isSessionGroupsQuery,
  isSessionHistoryRequest,
  isSessionOpenRequest,
  isSessionPromptRequest,
  isSessionRespondInteractionRequest,
  isSessionSetConfigOptionRequest,
} from "./commandParams.js";
import { ConsumerCommandSchema } from "./wire.js";
import type { ProviderId } from "@conduit/session-model";
import type {
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  GlobalCommandTarget,
  PresenceUpdateRequest,
  SessionGroupsCommandTarget,
} from "./wire.js";

type ConduitFactory = (
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
) => ConsumerCommand;
type NonProjectConduitCommandName =
  | "settings/get"
  | "settings/update"
  | "presence/update"
  | "sessions/grouped"
  | "sessions/watch"
  | "providers/config_snapshot"
  | "session/open"
  | "session/set_config_option"
  | "session/respond_interaction"
  | "session/history"
  | "session/watch"
  | "session/prompt";

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

function readPresenceField(params: unknown, key: string): unknown {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    return undefined;
  }
  return Reflect.get(params, key);
}

function isPresenceUpdateRequest(
  params: unknown,
): params is PresenceUpdateRequest {
  const clientId = readPresenceField(params, "clientId");
  const displayName = readPresenceField(params, "displayName");
  const deviceKind = readPresenceField(params, "deviceKind");
  return (
    typeof clientId === "string" &&
    clientId.trim().length > 0 &&
    typeof displayName === "string" &&
    displayName.trim().length > 0 &&
    (deviceKind === "mobile" || deviceKind === "web")
  );
}

function createPresenceUpdateCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isPresenceUpdateRequest(params)) {
    throw new Error("presence/update params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "presence/update",
    provider: requireGlobalProvider("presence/update", provider),
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

function createSessionRespondInteractionCommand(
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
): ConsumerCommand {
  if (!isSessionRespondInteractionRequest(params)) {
    throw new Error("session/respond_interaction params are invalid");
  }
  return parseConsumerCommand({
    id,
    command: "session/respond_interaction",
    provider: requireGlobalProvider("session/respond_interaction", provider),
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

const conduitFactories: Record<NonProjectConduitCommandName, ConduitFactory> = {
  "settings/get": createSettingsGetCommand,
  "settings/update": createSettingsUpdateCommand,
  "presence/update": createPresenceUpdateCommand,
  "providers/config_snapshot": createProvidersConfigSnapshotCommand,
  "session/history": createSessionHistoryCommand,
  "session/open": createSessionOpenCommand,
  "session/set_config_option": createSessionSetConfigOptionCommand,
  "session/respond_interaction": createSessionRespondInteractionCommand,
  "session/prompt": createSessionPromptCommand,
  "session/watch": createSessionWatchCommand,
  "sessions/grouped": createSessionGroupsCommand,
  "sessions/watch": createSessionsWatchCommand,
};

export { conduitFactories };
export type { NonProjectConduitCommandName };
