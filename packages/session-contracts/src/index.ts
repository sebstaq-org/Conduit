import type {
  ProviderId,
  ProviderSnapshot,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionOpenRequest,
} from "@conduit/session-model";
import {
  isSessionGroupsQuery,
  isSessionHistoryRequest,
  isSessionOpenRequest,
} from "./commandParams.js";

let nextCommandSequence = 0;

const CONDUIT_TRANSPORT_VERSION = 1 as const;

const SESSION_COMMANDS = [
  "initialize",
  "session/new",
  "session/list",
  "session/load",
  "session/prompt",
  "session/cancel",
] as const;

const CONDUIT_COMMANDS = [
  "snapshot/get",
  "provider/disconnect",
  "events/subscribe",
  "sessions/grouped",
  "session/open",
  "session/history",
] as const;

const CONSUMER_COMMANDS = [...SESSION_COMMANDS, ...CONDUIT_COMMANDS] as const;

type SessionCommandName = (typeof SESSION_COMMANDS)[number];

type ConduitCommandName = (typeof CONDUIT_COMMANDS)[number];

type ConsumerCommandName = (typeof CONSUMER_COMMANDS)[number];

type SessionGroupsCommandName = "sessions/grouped";

type SessionOpenCommandName = "session/open";

type SessionHistoryCommandName = "session/history";

type ProviderScopedCommandName = Exclude<
  ConsumerCommandName,
  SessionGroupsCommandName | SessionOpenCommandName | SessionHistoryCommandName
>;

interface ProviderConsumerCommand {
  id: string;
  command: ProviderScopedCommandName;
  provider: ProviderId;
  params: Record<string, unknown>;
}

interface SessionGroupsConsumerCommand {
  id: string;
  command: SessionGroupsCommandName;
  provider: ConsumerCommandTarget;
  params: SessionGroupsQuery;
}

interface SessionOpenConsumerCommand {
  id: string;
  command: SessionOpenCommandName;
  provider: ProviderId;
  params: SessionOpenRequest;
}

interface SessionHistoryConsumerCommand {
  id: string;
  command: SessionHistoryCommandName;
  provider: ProviderId;
  params: SessionHistoryRequest;
}

type ConsumerCommand =
  | ProviderConsumerCommand
  | SessionGroupsConsumerCommand
  | SessionOpenConsumerCommand
  | SessionHistoryConsumerCommand;

type ConsumerCommandTarget = ProviderId | "all";

interface ConsumerError {
  code: string;
  message: string;
}

interface ConsumerResponse<Result = unknown> {
  id: string;
  ok: boolean;
  result: Result;
  error: ConsumerError | null;
  snapshot: ProviderSnapshot | null;
}

type RuntimeEventKind =
  | "provider_connected"
  | "provider_disconnected"
  | "session_observed"
  | "session_replay_update"
  | "prompt_started"
  | "prompt_update_observed"
  | "prompt_completed"
  | "cancel_sent"
  | "raw_wire_event_captured";

interface RuntimeEvent {
  sequence: number;
  kind: RuntimeEventKind;
  provider: ProviderId;
  session_id: string | null;
  payload: unknown;
}

interface ClientCommandFrame {
  v: typeof CONDUIT_TRANSPORT_VERSION;
  type: "command";
  id: string;
  command: ConsumerCommand;
}

interface ServerResponseFrame {
  v: typeof CONDUIT_TRANSPORT_VERSION;
  type: "response";
  id: string;
  response: ConsumerResponse;
}

interface ServerEventFrame {
  v: typeof CONDUIT_TRANSPORT_VERSION;
  type: "event";
  event: RuntimeEvent;
}

type ServerFrame = ServerResponseFrame | ServerEventFrame;

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
    | SessionHistoryRequest = {},
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
  return {
    id,
    command,
    provider: requireProvider(command, provider),
    params: toRecordParams(params),
  };
}

export {
  CONDUIT_COMMANDS,
  CONDUIT_TRANSPORT_VERSION,
  CONSUMER_COMMANDS,
  SESSION_COMMANDS,
  createConsumerCommand,
};

export type {
  ClientCommandFrame,
  ConduitCommandName,
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  ConsumerError,
  ConsumerResponse,
  ProviderConsumerCommand,
  ProviderScopedCommandName,
  RuntimeEvent,
  RuntimeEventKind,
  ServerEventFrame,
  ServerFrame,
  ServerResponseFrame,
  SessionCommandName,
  SessionGroupsCommandName,
  SessionGroupsConsumerCommand,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionGroupsQuery,
  SessionGroupsView,
};
