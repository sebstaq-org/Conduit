import type { ProviderId, ProviderSnapshot } from "@conduit/session-model";

declare const transportVersionKey: "v";

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

interface TransportVersionFrame {
  [transportVersionKey]: 1;
}

interface ClientCommandFrame<Command = unknown> extends TransportVersionFrame {
  type: "command";
  id: string;
  command: Command;
}

interface ServerResponseFrame extends TransportVersionFrame {
  type: "response";
  id: string;
  response: ConsumerResponse;
}

interface ServerEventFrame extends TransportVersionFrame {
  type: "event";
  event: RuntimeEvent;
}

type ServerFrame = ServerResponseFrame | ServerEventFrame;

export type {
  ClientCommandFrame,
  ConsumerError,
  ConsumerResponse,
  RuntimeEvent,
  RuntimeEventKind,
  ServerEventFrame,
  ServerFrame,
  ServerResponseFrame,
};
