import { z } from "zod";

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
    updatedWithinDays: z.number().nullable().optional(),
  })
  .strict();

type SessionGroupsQuery = z.infer<typeof SessionGroupsQuerySchema>;

const ProjectRowSchema = z.object({
  projectId: z.string(),
  cwd: z.string(),
});

type ProjectRow = z.infer<typeof ProjectRowSchema>;

const ProjectListViewSchema = z.object({
  projects: z.array(ProjectRowSchema),
});

type ProjectListView = z.infer<typeof ProjectListViewSchema>;

interface ProjectAddRequest {
  cwd: string;
}

interface ProjectRemoveRequest {
  projectId: string;
}

type TranscriptMessageRole = "user" | "agent";

type TranscriptItemStatus = "complete" | "streaming" | "cancelled" | "failed";

interface TextContentBlock {
  type: "text";
  text: string;
}

type ContentBlock = TextContentBlock | Record<string, unknown>;

interface TranscriptMessageItem {
  kind: "message";
  id: string;
  turnId?: string;
  status?: TranscriptItemStatus;
  stopReason?: string;
  role: TranscriptMessageRole;
  content: ContentBlock[];
}

interface TranscriptEventItem {
  kind: "event";
  id: string;
  turnId?: string;
  status?: TranscriptItemStatus;
  stopReason?: string;
  variant: string;
  data: unknown;
}

type TranscriptItem = TranscriptMessageItem | TranscriptEventItem;

interface SessionOpenRequest {
  sessionId: string;
  cwd: string;
  limit?: number;
}

interface SessionHistoryRequest {
  openSessionId: string;
  cursor?: string | null;
  limit?: number;
}

interface SessionPromptRequest {
  openSessionId: string;
  prompt: ContentBlock[];
}

interface SessionHistoryWindow {
  openSessionId: string;
  revision: number;
  items: TranscriptItem[];
  nextCursor: string | null;
}

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
  return {
    provider,
    acpSessionId,
  };
}

function getProviderDescriptor(provider: ProviderId): ProviderDescriptor {
  return PROVIDER_CATALOG[provider];
}

export {
  PROVIDER_CATALOG,
  PROVIDERS,
  ProviderIdSchema,
  ProjectListViewSchema,
  ProjectRowSchema,
  SessionGroupSchema,
  SessionGroupsQuerySchema,
  SessionGroupsViewSchema,
  SessionRowSchema,
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
  RawWireEvent,
  SessionGroup,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionRow,
  ContentBlock,
  SessionHistoryRequest,
  SessionHistoryWindow,
  SessionOpenRequest,
  SessionPromptRequest,
  TranscriptEventItem,
  TranscriptItem,
  TranscriptItemStatus,
  TranscriptMessageItem,
  TranscriptMessageRole,
  TranscriptUpdateSnapshot,
};
