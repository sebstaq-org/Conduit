import type { ProviderId, ProviderSnapshot } from "@conduit/session-model";

let nextCommandSequence = 0;

export const CONDUIT_TRANSPORT_VERSION = 1 as const;

export const SESSION_COMMANDS = [
  "initialize",
  "session/new",
  "session/list",
  "session/load",
  "session/prompt",
  "session/cancel",
] as const;

export const CONDUIT_COMMANDS = [
  "snapshot/get",
  "provider/disconnect",
  "events/subscribe",
] as const;

export const CONSUMER_COMMANDS = [
  ...SESSION_COMMANDS,
  ...CONDUIT_COMMANDS,
] as const;

export type SessionCommandName = (typeof SESSION_COMMANDS)[number];

export type ConduitCommandName = (typeof CONDUIT_COMMANDS)[number];

export type ConsumerCommandName = (typeof CONSUMER_COMMANDS)[number];

export interface ConsumerCommand {
  id: string;
  command: ConsumerCommandName;
  provider: ProviderId;
  params: Record<string, unknown>;
}

export interface ConsumerError {
  code: string;
  message: string;
}

export interface ConsumerResponse<Result = unknown> {
  id: string;
  ok: boolean;
  result: Result;
  error: ConsumerError | null;
  snapshot: ProviderSnapshot | null;
}

export type RuntimeEventKind =
  | "provider_connected"
  | "provider_disconnected"
  | "session_observed"
  | "prompt_started"
  | "prompt_update_observed"
  | "prompt_completed"
  | "cancel_sent"
  | "raw_wire_event_captured";

export interface RuntimeEvent {
  sequence: number;
  kind: RuntimeEventKind;
  provider: ProviderId;
  session_id: string | null;
  payload: unknown;
}

export interface ClientCommandFrame {
  v: typeof CONDUIT_TRANSPORT_VERSION;
  type: "command";
  id: string;
  command: ConsumerCommand;
}

export interface ServerResponseFrame {
  v: typeof CONDUIT_TRANSPORT_VERSION;
  type: "response";
  id: string;
  response: ConsumerResponse;
}

export interface ServerEventFrame {
  v: typeof CONDUIT_TRANSPORT_VERSION;
  type: "event";
  event: RuntimeEvent;
}

export type ServerFrame = ServerResponseFrame | ServerEventFrame;

export function createConsumerCommand(
  command: ConsumerCommandName,
  provider: ProviderId,
  params: Record<string, unknown> = {},
  id = nextConsumerCommandId(),
): ConsumerCommand {
  return {
    id,
    command,
    provider,
    params,
  };
}

function nextConsumerCommandId(): string {
  nextCommandSequence += 1;
  return `conduit-command-${String(nextCommandSequence)}`;
}
