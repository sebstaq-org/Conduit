import type {
  ProviderId,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
  TranscriptItem,
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
  "provider/disconnect",
  "sessions/grouped",
  "sessions/watch",
  "session/open",
  "session/history",
  "session/watch",
] as const;

const CONSUMER_COMMANDS = [...SESSION_COMMANDS, ...CONDUIT_COMMANDS] as const;

type SessionCommandName = (typeof SESSION_COMMANDS)[number];

type ConduitCommandName = (typeof CONDUIT_COMMANDS)[number];

type ConsumerCommandName = (typeof CONSUMER_COMMANDS)[number];

type SessionGroupsCommandName = "sessions/grouped";

type SessionsWatchCommandName = "sessions/watch";

type SessionOpenCommandName = "session/open";

type SessionHistoryCommandName = "session/history";

type SessionWatchCommandName = "session/watch";

type SessionPromptCommandName = "session/prompt";

type ProviderScopedCommandName = Exclude<
  ConsumerCommandName,
  | SessionGroupsCommandName
  | SessionsWatchCommandName
  | SessionOpenCommandName
  | SessionHistoryCommandName
  | SessionWatchCommandName
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

interface SessionsWatchConsumerCommand {
  id: string;
  command: SessionsWatchCommandName;
  provider: ConsumerCommandTarget;
  params: Record<string, never>;
}

interface SessionHistoryConsumerCommand {
  id: string;
  command: SessionHistoryCommandName;
  provider: ConsumerCommandTarget;
  params: SessionHistoryRequest;
}

interface SessionWatchConsumerCommand {
  id: string;
  command: SessionWatchCommandName;
  provider: ConsumerCommandTarget;
  params: SessionHistoryRequest;
}

interface SessionPromptConsumerCommand {
  id: string;
  command: SessionPromptCommandName;
  provider: ConsumerCommandTarget;
  params: SessionPromptRequest;
}

type ConsumerCommand =
  | ProviderConsumerCommand
  | SessionGroupsConsumerCommand
  | SessionsWatchConsumerCommand
  | SessionOpenConsumerCommand
  | SessionHistoryConsumerCommand
  | SessionWatchConsumerCommand
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
}

type RuntimeEventKind = "session_timeline_changed" | "sessions_index_changed";

interface RuntimeEvent {
  kind: RuntimeEventKind;
  openSessionId?: string;
  revision: number;
  items?: TranscriptItem[];
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
  SessionsWatchCommandName,
  SessionsWatchConsumerCommand,
  SessionWatchCommandName,
  SessionWatchConsumerCommand,
};
