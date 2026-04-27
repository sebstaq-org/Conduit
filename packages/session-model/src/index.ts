/* eslint-disable max-lines -- shared session model contracts are intentionally centralized. */
import { z } from "zod";

const MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS = 1 as const;
const MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS = 365 as const;
const DEFAULT_SESSION_GROUPS_UPDATED_WITHIN_DAYS = 5 as const;

const SessionGroupsUpdatedWithinDaysSchema = z
  .number()
  .int()
  .min(MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS)
  .max(MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS);
const GlobalSettingsViewSchema = z
  .object({
    sessionGroupsUpdatedWithinDays:
      SessionGroupsUpdatedWithinDaysSchema.nullable(),
  })
  .strict();
const GlobalSettingsUpdateRequestSchema = z
  .object({
    sessionGroupsUpdatedWithinDays:
      SessionGroupsUpdatedWithinDaysSchema.nullable(),
  })
  .strict();

type GlobalSettingsView = z.infer<typeof GlobalSettingsViewSchema>;
type GlobalSettingsUpdateRequest = z.infer<
  typeof GlobalSettingsUpdateRequestSchema
>;

const PROVIDERS = ["claude", "copilot", "codex"] as const;
const ProviderIdSchema = z.enum(PROVIDERS);
type ProviderId = z.infer<typeof ProviderIdSchema>;
type ConnectionState = "disconnected" | "ready";
interface ProviderDescriptor {
  id: ProviderId;
  launcher: string;
  authSource: "local-login-state";
  phaseStatus: "phase-1";
}
const PROVIDER_CATALOG = {
  claude: {
    id: "claude",
    launcher: "claude-agent-acp",
    authSource: "local-login-state",
    phaseStatus: "phase-1",
  },
  copilot: {
    id: "copilot",
    launcher: "copilot --acp --allow-all --no-color --no-auto-update",
    authSource: "local-login-state",
    phaseStatus: "phase-1",
  },
  codex: {
    id: "codex",
    launcher: "codex-acp",
    authSource: "local-login-state",
    phaseStatus: "phase-1",
  },
} as const satisfies Record<ProviderId, ProviderDescriptor>;
interface LiveSessionIdentity {
  provider: ProviderId;
  acpSessionId: string;
}
interface LiveSessionSnapshot {
  identity: LiveSessionIdentity;
  cwd: string;
  title: string | null;
  observedVia: string;
}
type PromptLifecycleState = "idle" | "running" | "completed" | "cancelled";
interface PromptLifecycleSnapshot {
  identity: LiveSessionIdentity;
  state: PromptLifecycleState;
  stopReason: string | null;
  rawUpdateCount: number;
  agentTextChunks: string[];
  updates: TranscriptUpdateSnapshot[];
}
interface TranscriptUpdateSnapshot {
  index: number;
  variant: string;
  update: unknown;
}
interface LoadedTranscriptSnapshot {
  identity: LiveSessionIdentity;
  rawUpdateCount: number;
  updates: TranscriptUpdateSnapshot[];
}
const SessionRowSchema = z.object({
  provider: ProviderIdSchema,
  sessionId: z.string(),
  title: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
type SessionRow = z.infer<typeof SessionRowSchema>;
const SessionGroupSchema = z.object({
  groupId: z.string(),
  cwd: z.string(),
  displayName: z.string(),
  sessions: z.array(SessionRowSchema),
});
type SessionGroup = z.infer<typeof SessionGroupSchema>;
const SessionGroupsViewSchema = z.object({
  revision: z.number(),
  refreshedAt: z.string().nullable(),
  isRefreshing: z.boolean(),
  groups: z.array(SessionGroupSchema),
});
type SessionGroupsView = z.infer<typeof SessionGroupsViewSchema>;
const SessionGroupsQuerySchema = z
  .object({
    updatedWithinDays:
      SessionGroupsUpdatedWithinDaysSchema.nullable().optional(),
  })
  .strict();
type SessionGroupsQuery = z.infer<typeof SessionGroupsQuerySchema>;
const ProjectRowSchema = z.object({
  projectId: z.string(),
  cwd: z.string(),
  displayName: z.string(),
});
type ProjectRow = z.infer<typeof ProjectRowSchema>;
const ProjectListViewSchema = z.object({
  projects: z.array(ProjectRowSchema),
});
type ProjectListView = z.infer<typeof ProjectListViewSchema>;
const ProjectSuggestionSchema = z.object({
  suggestionId: z.string(),
  cwd: z.string(),
});
type ProjectSuggestion = z.infer<typeof ProjectSuggestionSchema>;
const ProjectSuggestionsViewSchema = z.object({
  suggestions: z.array(ProjectSuggestionSchema),
});
type ProjectSuggestionsView = z.infer<typeof ProjectSuggestionsViewSchema>;
const ProjectAddRequestSchema = z.object({ cwd: z.string() }).strict();
type ProjectAddRequest = z.infer<typeof ProjectAddRequestSchema>;
const ProjectRemoveRequestSchema = z.object({ projectId: z.string() }).strict();
type ProjectRemoveRequest = z.infer<typeof ProjectRemoveRequestSchema>;
const ProjectUpdateRequestSchema = z
  .object({ projectId: z.string(), displayName: z.string() })
  .strict();
type ProjectUpdateRequest = z.infer<typeof ProjectUpdateRequestSchema>;
const ProjectSuggestionsQuerySchema = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().positive().optional(),
  })
  .strict();
type ProjectSuggestionsQuery = z.infer<typeof ProjectSuggestionsQuerySchema>;
type TranscriptMessageRole = "user" | "agent";
type TranscriptItemStatus = "complete" | "streaming" | "cancelled" | "failed";
type TranscriptEventSource = "provider" | "conduit";
const TextContentBlockSchema = z
  .object({ type: z.literal("text"), text: z.string() })
  .strict();
const UnknownContentBlockSchema = z.record(z.string(), z.unknown());
const ContentBlockSchema = z.union([
  TextContentBlockSchema,
  UnknownContentBlockSchema,
]);
type ContentBlock = z.infer<typeof ContentBlockSchema>;
interface TranscriptMessageItem {
  kind: "message";
  id: string;
  turnId?: string | undefined;
  status?: TranscriptItemStatus | undefined;
  stopReason?: string | undefined;
  role: TranscriptMessageRole;
  content: ContentBlock[];
}
interface TranscriptEventItem {
  kind: "event";
  id: string;
  turnId?: string | undefined;
  status?: TranscriptItemStatus | undefined;
  stopReason?: string | undefined;
  source: TranscriptEventSource;
  variant: string;
  data: unknown;
}
type TranscriptItem = TranscriptMessageItem | TranscriptEventItem;
const SessionOpenRequestSchema = z
  .object({
    sessionId: z.string(),
    cwd: z.string(),
    limit: z.number().int().positive().optional(),
  })
  .strict();
type SessionOpenRequest = z.infer<typeof SessionOpenRequestSchema>;
const SessionNewRequestSchema = z
  .object({
    cwd: z.string(),
    limit: z.number().int().positive().optional(),
  })
  .strict();
type SessionNewRequest = z.infer<typeof SessionNewRequestSchema>;
const SessionHistoryRequestSchema = z
  .object({
    openSessionId: z.string(),
    cursor: z.string().nullable().optional(),
    limit: z.number().int().positive().optional(),
  })
  .strict();
type SessionHistoryRequest = z.infer<typeof SessionHistoryRequestSchema>;
const SessionPromptRequestSchema = z
  .object({
    openSessionId: z.string(),
    prompt: z.array(ContentBlockSchema),
  })
  .strict();
type SessionPromptRequest = z.infer<typeof SessionPromptRequestSchema>;
const SessionRespondInteractionSelectedSchema = z
  .object({
    kind: z.literal("selected"),
    optionId: z.string().min(1),
  })
  .strict();
const SessionRespondInteractionAnswerOtherSchema = z
  .object({
    kind: z.literal("answer_other"),
    optionId: z.string().min(1).optional(),
    questionId: z.string().min(1),
    text: z.string(),
  })
  .strict();
const SessionRespondInteractionCancelSchema = z
  .object({
    kind: z.literal("cancel"),
  })
  .strict();
const SessionRespondInteractionResponseSchema = z.union([
  SessionRespondInteractionSelectedSchema,
  SessionRespondInteractionAnswerOtherSchema,
  SessionRespondInteractionCancelSchema,
]);
type SessionRespondInteractionResponse = z.infer<
  typeof SessionRespondInteractionResponseSchema
>;
const SessionRespondInteractionRequestSchema = z
  .object({
    openSessionId: z.string(),
    interactionId: z.string(),
    response: SessionRespondInteractionResponseSchema,
  })
  .strict();
type SessionRespondInteractionRequest = z.infer<
  typeof SessionRespondInteractionRequestSchema
>;
const SessionConfigOptionValueSchema = z
  .object({
    _meta: z.record(z.string(), z.unknown()).nullable().optional(),
    value: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
  })
  .strict();
const SessionConfigOptionGroupSchema = z
  .object({
    _meta: z.record(z.string(), z.unknown()).nullable().optional(),
    group: z.string(),
    name: z.string(),
    options: z.array(SessionConfigOptionValueSchema),
  })
  .strict();
const RawSessionConfigOptionSchema = z
  .object({
    _meta: z.record(z.string(), z.unknown()).nullable().optional(),
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    type: z.string(),
    currentValue: z.string(),
    options: z.union([
      z.array(SessionConfigOptionValueSchema),
      z.array(SessionConfigOptionGroupSchema),
    ]),
  })
  .strict();
function flattenedSessionConfigValues(
  options: z.infer<typeof RawSessionConfigOptionSchema>["options"],
): z.infer<typeof SessionConfigOptionValueSchema>[] {
  return options.flatMap((entry) => {
    if ("group" in entry) {
      return entry.options;
    }
    return [entry];
  });
}

const SessionConfigOptionSchema = RawSessionConfigOptionSchema.transform(
  (option) => ({
    id: option.id,
    name: option.name,
    description: option.description,
    category: option.category,
    type: option.type,
    currentValue: option.currentValue,
    values: flattenedSessionConfigValues(option.options),
  }),
);
type SessionConfigOption = z.infer<typeof SessionConfigOptionSchema>;
const SessionSetConfigOptionRequestSchema = z
  .object({
    sessionId: z.string(),
    configId: z.string(),
    value: z.string(),
  })
  .strict();
type SessionSetConfigOptionRequest = z.infer<
  typeof SessionSetConfigOptionRequestSchema
>;
const TranscriptMessageItemSchema = z
  .object({
    kind: z.literal("message"),
    id: z.string(),
    turnId: z.string().optional(),
    status: z.enum(["complete", "streaming", "cancelled", "failed"]).optional(),
    stopReason: z.string().optional(),
    role: z.enum(["user", "agent"]),
    content: z.array(ContentBlockSchema),
  })
  .strict();
const TranscriptEventItemSchema = z
  .object({
    kind: z.literal("event"),
    id: z.string(),
    turnId: z.string().optional(),
    status: z.enum(["complete", "streaming", "cancelled", "failed"]).optional(),
    stopReason: z.string().optional(),
    source: z.enum(["provider", "conduit"]),
    variant: z.string(),
    data: z.unknown(),
  })
  .strict();
const TranscriptItemSchema = z.union([
  TranscriptMessageItemSchema,
  TranscriptEventItemSchema,
]);
const SessionHistoryWindowSchema = z
  .object({
    openSessionId: z.string(),
    revision: z.number(),
    items: z.array(TranscriptItemSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
type SessionHistoryWindow = z.infer<typeof SessionHistoryWindowSchema>;
const SessionNewResultSchema = z
  .object({
    sessionId: z.string(),
    currentModeId: z.string().nullable().optional(),
    configOptions: z.array(SessionConfigOptionSchema).nullable().optional(),
    modes: z.unknown().nullable().optional(),
    models: z.unknown().nullable().optional(),
    history: SessionHistoryWindowSchema,
  })
  .strict();
type SessionNewResult = z.infer<typeof SessionNewResultSchema>;
const SessionOpenResultSchema = z
  .object({
    sessionId: z.string(),
    currentModeId: z.string().nullable().optional(),
    configOptions: z.array(SessionConfigOptionSchema).nullable().optional(),
    modes: z.unknown().nullable().optional(),
    models: z.unknown().nullable().optional(),
    openSessionId: z.string(),
    revision: z.number(),
    items: z.array(TranscriptItemSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
type SessionOpenResult = z.infer<typeof SessionOpenResultSchema>;
const SessionSetConfigOptionResultSchema = z
  .object({
    sessionId: z.string(),
    configOptions: z.array(SessionConfigOptionSchema),
  })
  .strict();
type SessionSetConfigOptionResult = z.infer<
  typeof SessionSetConfigOptionResultSchema
>;
const ProviderConfigSnapshotStatusSchema = z.enum([
  "loading",
  "ready",
  "error",
  "unavailable",
]);
type ProviderConfigSnapshotStatus = z.infer<
  typeof ProviderConfigSnapshotStatusSchema
>;
const ProviderConfigSnapshotEntrySchema = z
  .object({
    provider: ProviderIdSchema,
    status: ProviderConfigSnapshotStatusSchema,
    configOptions: z.array(SessionConfigOptionSchema).nullable(),
    modes: z.unknown().nullable(),
    models: z.unknown().nullable(),
    fetchedAt: z.string().nullable(),
    error: z.string().nullable(),
  })
  .strict();
type ProviderConfigSnapshotEntry = z.infer<
  typeof ProviderConfigSnapshotEntrySchema
>;
const ProvidersConfigSnapshotResultSchema = z
  .object({
    entries: z.array(ProviderConfigSnapshotEntrySchema),
  })
  .strict();
type ProvidersConfigSnapshotResult = z.infer<
  typeof ProvidersConfigSnapshotResultSchema
>;
interface ProviderSnapshot {
  provider: ProviderId;
  connectionState: ConnectionState;
  discovery: unknown;
  capabilities: unknown;
  authMethods: unknown[];
  liveSessions: LiveSessionSnapshot[];
  lastPrompt: PromptLifecycleSnapshot | null;
  loadedTranscripts: LoadedTranscriptSnapshot[];
}
interface RawWireEvent {
  sequence: number;
  stream: "outgoing" | "incoming" | "stderr";
  kind: "request" | "response" | "notification" | "diagnostic";
  payload: string;
  method: string | null;
  requestId: string | null;
  json: unknown;
}
function createLiveSessionIdentity(
  provider: ProviderId,
  acpSessionId: string,
): LiveSessionIdentity {
  return { provider, acpSessionId };
}
function getProviderDescriptor(provider: ProviderId): ProviderDescriptor {
  return PROVIDER_CATALOG[provider];
}
export {
  ContentBlockSchema,
  PROVIDER_CATALOG,
  PROVIDERS,
  DEFAULT_SESSION_GROUPS_UPDATED_WITHIN_DAYS,
  GlobalSettingsUpdateRequestSchema,
  GlobalSettingsViewSchema,
  MAX_SESSION_GROUPS_UPDATED_WITHIN_DAYS,
  MIN_SESSION_GROUPS_UPDATED_WITHIN_DAYS,
  ProviderIdSchema,
  ProjectAddRequestSchema,
  ProjectListViewSchema,
  ProjectRemoveRequestSchema,
  ProjectRowSchema,
  ProjectSuggestionSchema,
  ProjectSuggestionsQuerySchema,
  ProjectSuggestionsViewSchema,
  ProjectUpdateRequestSchema,
  SessionGroupSchema,
  SessionGroupsQuerySchema,
  SessionGroupsViewSchema,
  SessionGroupsUpdatedWithinDaysSchema,
  SessionHistoryRequestSchema,
  SessionHistoryWindowSchema,
  SessionConfigOptionSchema,
  SessionSetConfigOptionRequestSchema,
  SessionSetConfigOptionResultSchema,
  ProviderConfigSnapshotEntrySchema,
  ProviderConfigSnapshotStatusSchema,
  ProvidersConfigSnapshotResultSchema,
  SessionNewRequestSchema,
  SessionNewResultSchema,
  SessionOpenResultSchema,
  SessionOpenRequestSchema,
  SessionPromptRequestSchema,
  SessionRespondInteractionRequestSchema,
  SessionRespondInteractionResponseSchema,
  SessionRowSchema,
  TranscriptItemSchema,
  createLiveSessionIdentity,
  getProviderDescriptor,
};
export type {
  ConnectionState,
  LiveSessionIdentity,
  LiveSessionSnapshot,
  PromptLifecycleSnapshot,
  PromptLifecycleState,
  LoadedTranscriptSnapshot,
  ProviderDescriptor,
  ProviderId,
  ProviderSnapshot,
  ProjectAddRequest,
  ProjectListView,
  ProjectRemoveRequest,
  ProjectRow,
  ProjectSuggestion,
  ProjectSuggestionsQuery,
  ProjectSuggestionsView,
  ProjectUpdateRequest,
  RawWireEvent,
  SessionGroup,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionRow,
  ContentBlock,
  GlobalSettingsUpdateRequest,
  GlobalSettingsView,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionConfigOption,
  SessionSetConfigOptionRequest,
  SessionSetConfigOptionResult,
  ProviderConfigSnapshotEntry,
  ProviderConfigSnapshotStatus,
  ProvidersConfigSnapshotResult,
  SessionNewRequest,
  SessionNewResult,
  SessionOpenResult,
  SessionOpenRequest,
  SessionPromptRequest,
  SessionRespondInteractionRequest,
  SessionRespondInteractionResponse,
  TranscriptEventItem,
  TranscriptEventSource,
  TranscriptItem,
  TranscriptItemStatus,
  TranscriptMessageItem,
  TranscriptMessageRole,
  TranscriptUpdateSnapshot,
};
