import type { ProviderId, ProviderSnapshot } from "@conduit/session-model";

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
] as const;

const CONSUMER_COMMANDS = [...SESSION_COMMANDS, ...CONDUIT_COMMANDS] as const;

type SessionCommandName = (typeof SESSION_COMMANDS)[number];

type ConduitCommandName = (typeof CONDUIT_COMMANDS)[number];

type ConsumerCommandName = (typeof CONSUMER_COMMANDS)[number];

interface ConsumerCommand {
  id: string;
  command: ConsumerCommandName;
  provider: ProviderId;
  params: Record<string, unknown>;
}

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

function createConsumerCommand(
  command: ConsumerCommandName,
  provider: ProviderId,
  params: Record<string, unknown> = {},
): ConsumerCommand {
  return {
    id: nextConsumerCommandId(),
    command,
    provider,
    params,
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
  ConsumerError,
  ConsumerResponse,
  RuntimeEvent,
  RuntimeEventKind,
  ServerEventFrame,
  ServerFrame,
  ServerResponseFrame,
  SessionCommandName,
};
