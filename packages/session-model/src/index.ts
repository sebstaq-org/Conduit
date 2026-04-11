const PROVIDERS = ["claude", "copilot", "codex"] as const;

type ProviderId = (typeof PROVIDERS)[number];

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
}

interface ProviderSnapshot {
  provider: ProviderId;
  connectionState: ConnectionState;
  discovery: unknown;
  capabilities: unknown;
  authMethods: unknown[];
  liveSessions: LiveSessionSnapshot[];
  lastPrompt: PromptLifecycleSnapshot | null;
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
  createLiveSessionIdentity,
  getProviderDescriptor,
};

export type {
  ConnectionState,
  LiveSessionIdentity,
  LiveSessionSnapshot,
  PromptLifecycleSnapshot,
  PromptLifecycleState,
  ProviderDescriptor,
  ProviderId,
  ProviderSnapshot,
  RawWireEvent,
};
