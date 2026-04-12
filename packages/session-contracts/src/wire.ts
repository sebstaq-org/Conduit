import type {
  ProviderId,
  ProviderSnapshot,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
} from "@conduit/session-model";

const CONDUIT_TRANSPORT_VERSION = 1 as const;
const transportVersionField = "v";

const SESSION_COMMANDS = [
  "initialize",
  "session/new",
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

type SessionPromptCommandName = "session/prompt";

type ProviderScopedCommandName = Exclude<
  ConsumerCommandName,
  | SessionGroupsCommandName
  | SessionOpenCommandName
  | SessionHistoryCommandName
  | SessionPromptCommandName
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

interface SessionPromptConsumerCommand {
  id: string;
  command: SessionPromptCommandName;
  provider: ProviderId;
  params: SessionPromptRequest;
}

type ConsumerCommand =
  | ProviderConsumerCommand
  | SessionGroupsConsumerCommand
  | SessionOpenConsumerCommand
  | SessionHistoryConsumerCommand
  | SessionPromptConsumerCommand;

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
  | "session_timeline_changed"
  | "sessions_index_changed"
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
  [transportVersionField]: typeof CONDUIT_TRANSPORT_VERSION;
  type: "command";
  id: string;
  command: ConsumerCommand;
}

interface ServerResponseFrame {
  [transportVersionField]: typeof CONDUIT_TRANSPORT_VERSION;
  type: "response";
  id: string;
  response: ConsumerResponse;
}

interface ServerEventFrame {
  [transportVersionField]: typeof CONDUIT_TRANSPORT_VERSION;
  type: "event";
  event: RuntimeEvent;
}

type ServerFrame = ServerResponseFrame | ServerEventFrame;

export {
  CONDUIT_COMMANDS,
  CONDUIT_TRANSPORT_VERSION,
  CONSUMER_COMMANDS,
  SESSION_COMMANDS,
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
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryCommandName,
  SessionHistoryConsumerCommand,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenCommandName,
  SessionOpenConsumerCommand,
  SessionOpenRequest,
  SessionPromptCommandName,
  SessionPromptConsumerCommand,
  SessionPromptRequest,
};
