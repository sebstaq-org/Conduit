import type {
  ProviderId,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectRow,
  ProjectSuggestion,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
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
  "projects/add",
  "projects/list",
  "projects/remove",
  "projects/suggestions",
  "projects/update",
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

type ProjectAddCommandName = "projects/add";

type ProjectListCommandName = "projects/list";

type ProjectRemoveCommandName = "projects/remove";

type ProjectSuggestionsCommandName = "projects/suggestions";

type ProjectUpdateCommandName = "projects/update";

type SessionsWatchCommandName = "sessions/watch";

type SessionOpenCommandName = "session/open";

type SessionHistoryCommandName = "session/history";

type SessionWatchCommandName = "session/watch";

type SessionPromptCommandName = "session/prompt";

type ProviderScopedCommandName = Exclude<
  ConsumerCommandName,
  | SessionGroupsCommandName
  | ProjectAddCommandName
  | ProjectListCommandName
  | ProjectRemoveCommandName
  | ProjectSuggestionsCommandName
  | ProjectUpdateCommandName
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

interface ProjectAddConsumerCommand {
  id: string;
  command: ProjectAddCommandName;
  provider: ConsumerCommandTarget;
  params: ProjectAddRequest;
}

interface ProjectListConsumerCommand {
  id: string;
  command: ProjectListCommandName;
  provider: ConsumerCommandTarget;
  params: Record<string, never>;
}

interface ProjectRemoveConsumerCommand {
  id: string;
  command: ProjectRemoveCommandName;
  provider: ConsumerCommandTarget;
  params: ProjectRemoveRequest;
}

interface ProjectSuggestionsConsumerCommand {
  id: string;
  command: ProjectSuggestionsCommandName;
  provider: ConsumerCommandTarget;
  params: ProjectSuggestionsQuery;
}

interface ProjectUpdateConsumerCommand {
  id: string;
  command: ProjectUpdateCommandName;
  provider: ConsumerCommandTarget;
  params: ProjectUpdateRequest;
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
  | ProjectAddConsumerCommand
  | ProjectListConsumerCommand
  | ProjectRemoveConsumerCommand
  | ProjectSuggestionsConsumerCommand
  | ProjectUpdateConsumerCommand
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
  ProjectAddCommandName,
  ProjectAddConsumerCommand,
  ProjectAddRequest,
  ProjectListCommandName,
  ProjectListConsumerCommand,
  ProjectListView,
  ProjectRemoveCommandName,
  ProjectRemoveConsumerCommand,
  ProjectRemoveRequest,
  ProjectRow,
  ProjectSuggestion,
  ProjectSuggestionsCommandName,
  ProjectSuggestionsConsumerCommand,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateCommandName,
  ProjectUpdateConsumerCommand,
  ProjectUpdateRequest,
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
