/* eslint-disable max-lines -- canonical transport contract is intentionally co-located. */
import { z } from "zod";
import type {
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
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
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
  SessionNewRequest,
  SessionNewResult,
  ProvidersConfigSnapshotResult,
  SessionOpenResult,
  SessionOpenRequest,
  SessionPromptRequest,
  TranscriptItem,
} from "@conduit/session-model";
import {
  GlobalSettingsUpdateRequestSchema,
  ProviderIdSchema,
  ProjectAddRequestSchema,
  ProjectRemoveRequestSchema,
  ProjectSuggestionsQuerySchema,
  ProjectUpdateRequestSchema,
  SessionGroupsQuerySchema,
  SessionHistoryRequestSchema,
  SessionNewRequestSchema,
  SessionSetConfigOptionRequestSchema,
  SessionOpenRequestSchema,
  SessionPromptRequestSchema,
  TranscriptItemSchema,
} from "@conduit/session-model";

const CONDUIT_TRANSPORT_VERSION = 1 as const;
const transportVersionField = "v";
const SESSION_COMMANDS = [
  "initialize",
  "session/new",
  "session/set_config_option",
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
  "settings/get",
  "settings/update",
  "sessions/grouped",
  "sessions/watch",
  "providers/config_snapshot",
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
type SettingsGetCommandName = "settings/get";
type SettingsUpdateCommandName = "settings/update";
type SessionsWatchCommandName = "sessions/watch";
type ProvidersConfigSnapshotCommandName = "providers/config_snapshot";
type SessionOpenCommandName = "session/open";
type SessionSetConfigOptionCommandName = "session/set_config_option";
type SessionHistoryCommandName = "session/history";
type SessionWatchCommandName = "session/watch";
type SessionPromptCommandName = "session/prompt";
type GlobalCommandTarget = "all";
type SessionGroupsCommandTarget = ProviderId | GlobalCommandTarget;
type ConsumerCommandTarget = SessionGroupsCommandTarget;
type ProviderScopedCommandName =
  | "initialize"
  | "session/new"
  | "session/set_config_option"
  | "session/cancel"
  | "provider/disconnect"
  | "session/open";

const ProviderCommandParamsSchema = z.record(z.string(), z.unknown());
const EmptyParamsSchema = z.object({}).strict();
const GlobalProviderTargetSchema = z.literal("all");
const SessionGroupsProviderTargetSchema = z.union([
  ProviderIdSchema,
  GlobalProviderTargetSchema,
]);

const ProviderConsumerCommandSchema = z.union([
  z
    .object({
      id: z.string(),
      command: z.literal("initialize"),
      provider: ProviderIdSchema,
      params: ProviderCommandParamsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string(),
      command: z.literal("session/new"),
      provider: ProviderIdSchema,
      params: SessionNewRequestSchema,
    })
    .strict(),
  z
    .object({
      id: z.string(),
      command: z.literal("session/set_config_option"),
      provider: ProviderIdSchema,
      params: SessionSetConfigOptionRequestSchema,
    })
    .strict(),
  z
    .object({
      id: z.string(),
      command: z.literal("session/cancel"),
      provider: ProviderIdSchema,
      params: ProviderCommandParamsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string(),
      command: z.literal("provider/disconnect"),
      provider: ProviderIdSchema,
      params: ProviderCommandParamsSchema,
    })
    .strict(),
  z
    .object({
      id: z.string(),
      command: z.literal("session/open"),
      provider: ProviderIdSchema,
      params: SessionOpenRequestSchema,
    })
    .strict(),
]);

const SessionGroupsConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("sessions/grouped"),
    provider: SessionGroupsProviderTargetSchema,
    params: SessionGroupsQuerySchema,
  })
  .strict();
const ProjectAddConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("projects/add"),
    provider: GlobalProviderTargetSchema,
    params: ProjectAddRequestSchema,
  })
  .strict();
const ProjectListConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("projects/list"),
    provider: GlobalProviderTargetSchema,
    params: EmptyParamsSchema,
  })
  .strict();
const ProjectRemoveConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("projects/remove"),
    provider: GlobalProviderTargetSchema,
    params: ProjectRemoveRequestSchema,
  })
  .strict();
const ProjectSuggestionsConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("projects/suggestions"),
    provider: GlobalProviderTargetSchema,
    params: ProjectSuggestionsQuerySchema,
  })
  .strict();
const ProjectUpdateConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("projects/update"),
    provider: GlobalProviderTargetSchema,
    params: ProjectUpdateRequestSchema,
  })
  .strict();
const SettingsGetConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("settings/get"),
    provider: GlobalProviderTargetSchema,
    params: EmptyParamsSchema,
  })
  .strict();
const SettingsUpdateConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("settings/update"),
    provider: GlobalProviderTargetSchema,
    params: GlobalSettingsUpdateRequestSchema,
  })
  .strict();
const SessionsWatchConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("sessions/watch"),
    provider: GlobalProviderTargetSchema,
    params: EmptyParamsSchema,
  })
  .strict();
const ProvidersConfigSnapshotConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("providers/config_snapshot"),
    provider: GlobalProviderTargetSchema,
    params: EmptyParamsSchema,
  })
  .strict();
const SessionHistoryConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("session/history"),
    provider: GlobalProviderTargetSchema,
    params: SessionHistoryRequestSchema,
  })
  .strict();
const SessionWatchConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("session/watch"),
    provider: GlobalProviderTargetSchema,
    params: SessionHistoryRequestSchema,
  })
  .strict();
const SessionPromptConsumerCommandSchema = z
  .object({
    id: z.string(),
    command: z.literal("session/prompt"),
    provider: GlobalProviderTargetSchema,
    params: SessionPromptRequestSchema,
  })
  .strict();
const ConsumerCommandSchema = z.union([
  ProviderConsumerCommandSchema,
  SessionGroupsConsumerCommandSchema,
  ProjectAddConsumerCommandSchema,
  ProjectListConsumerCommandSchema,
  ProjectRemoveConsumerCommandSchema,
  ProjectSuggestionsConsumerCommandSchema,
  ProjectUpdateConsumerCommandSchema,
  SettingsGetConsumerCommandSchema,
  SettingsUpdateConsumerCommandSchema,
  SessionsWatchConsumerCommandSchema,
  ProvidersConfigSnapshotConsumerCommandSchema,
  SessionHistoryConsumerCommandSchema,
  SessionWatchConsumerCommandSchema,
  SessionPromptConsumerCommandSchema,
]);

type ProviderConsumerCommand = z.infer<typeof ProviderConsumerCommandSchema>;
type SessionGroupsConsumerCommand = z.infer<
  typeof SessionGroupsConsumerCommandSchema
>;
type ProjectAddConsumerCommand = z.infer<
  typeof ProjectAddConsumerCommandSchema
>;
type ProjectListConsumerCommand = z.infer<
  typeof ProjectListConsumerCommandSchema
>;
type ProjectRemoveConsumerCommand = z.infer<
  typeof ProjectRemoveConsumerCommandSchema
>;
type ProjectSuggestionsConsumerCommand = z.infer<
  typeof ProjectSuggestionsConsumerCommandSchema
>;
type ProjectUpdateConsumerCommand = z.infer<
  typeof ProjectUpdateConsumerCommandSchema
>;
type SettingsGetConsumerCommand = z.infer<
  typeof SettingsGetConsumerCommandSchema
>;
type SettingsUpdateConsumerCommand = z.infer<
  typeof SettingsUpdateConsumerCommandSchema
>;
type SessionsWatchConsumerCommand = z.infer<
  typeof SessionsWatchConsumerCommandSchema
>;
type ProvidersConfigSnapshotConsumerCommand = z.infer<
  typeof ProvidersConfigSnapshotConsumerCommandSchema
>;
type SessionOpenConsumerCommand = Extract<
  ProviderConsumerCommand,
  { command: "session/open" }
>;
type SessionNewConsumerCommand = Extract<
  ProviderConsumerCommand,
  { command: "session/new" }
>;
type SessionSetConfigOptionConsumerCommand = Extract<
  ProviderConsumerCommand,
  { command: "session/set_config_option" }
>;
type SessionHistoryConsumerCommand = z.infer<
  typeof SessionHistoryConsumerCommandSchema
>;
type SessionWatchConsumerCommand = z.infer<
  typeof SessionWatchConsumerCommandSchema
>;
type SessionPromptConsumerCommand = z.infer<
  typeof SessionPromptConsumerCommandSchema
>;
type ConsumerCommand = z.infer<typeof ConsumerCommandSchema>;

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
const RuntimeEventSchema = z
  .object({
    kind: z.enum(["session_timeline_changed", "sessions_index_changed"]),
    openSessionId: z.string().optional(),
    revision: z.number(),
    items: z.array(TranscriptItemSchema).optional(),
  })
  .strict();
type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;
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
  ConsumerCommandSchema,
  RuntimeEventSchema,
};
export type {
  ClientCommandFrame,
  ConduitCommandName,
  ConsumerCommand,
  ConsumerCommandName,
  ConsumerCommandTarget,
  ConsumerError,
  ConsumerResponse,
  GlobalCommandTarget,
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
  SessionGroupsCommandTarget,
  SessionGroupsConsumerCommand,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionHistoryCommandName,
  SessionHistoryConsumerCommand,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionNewConsumerCommand,
  SessionNewRequest,
  SessionNewResult,
  SessionOpenCommandName,
  SessionOpenConsumerCommand,
  SessionOpenResult,
  SessionOpenRequest,
  SessionSetConfigOptionCommandName,
  SessionSetConfigOptionConsumerCommand,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
  SessionPromptCommandName,
  SessionPromptConsumerCommand,
  SessionPromptRequest,
  SessionsWatchCommandName,
  SessionsWatchConsumerCommand,
  ProvidersConfigSnapshotCommandName,
  ProvidersConfigSnapshotConsumerCommand,
  ProvidersConfigSnapshotResult,
  SessionWatchCommandName,
  SessionWatchConsumerCommand,
  SettingsGetCommandName,
  SettingsGetConsumerCommand,
  SettingsUpdateCommandName,
  SettingsUpdateConsumerCommand,
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  ProviderId,
  TranscriptItem,
};
