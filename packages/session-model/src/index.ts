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
  groups: z.array(SessionGroupSchema),
});

type SessionGroupsView = z.infer<typeof SessionGroupsViewSchema>;

const SessionGroupsQuerySchema = z.object({
  cwdFilters: z.array(z.string()).optional(),
  updatedWithinDays: z.number().nullable().optional(),
});

type SessionGroupsQuery = z.infer<typeof SessionGroupsQuerySchema>;

type TranscriptMessageRole = "user" | "agent";

type TranscriptItemStatus = "complete" | "streaming" | "cancelled" | "failed";

interface TranscriptMessageItem {
  kind: "message";
  id: string;
  turnId?: string;
  status?: TranscriptItemStatus;
  role: TranscriptMessageRole;
  text: string;
  sourceVariants: string[];
}

interface TranscriptEventItem {
  kind: "event";
  id: string;
  variant: string;
  title: string;
  defaultCollapsed: true;
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
  prompt: string;
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
  RawWireEvent,
  SessionGroup,
  SessionGroupsQuery,
  SessionGroupsView,
  SessionRow,
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
