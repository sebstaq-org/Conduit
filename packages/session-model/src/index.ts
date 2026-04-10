export const PROVIDERS = ["claude", "copilot", "codex"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export type ConnectionState = "disconnected" | "ready";

export interface ProviderDescriptor {
  id: ProviderId;
  launcher: string;
  authSource: "local-login-state";
  phaseStatus: "phase-1";
}

export const PROVIDER_CATALOG = {
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

export interface LiveSessionIdentity {
  provider: ProviderId;
  acpSessionId: string;
}

export interface LiveSessionSnapshot {
  identity: LiveSessionIdentity;
  cwd: string;
  title: string | null;
  observedVia: string;
}

export type PromptLifecycleState =
  | "idle"
  | "running"
  | "completed"
  | "cancelled";

export interface PromptLifecycleSnapshot {
  identity: LiveSessionIdentity;
  state: PromptLifecycleState;
  stopReason: string | null;
  rawUpdateCount: number;
}

export interface ProviderSnapshot {
  provider: ProviderId;
  connectionState: ConnectionState;
  discovery: unknown;
  capabilities: unknown;
  authMethods: unknown[];
  liveSessions: LiveSessionSnapshot[];
  lastPrompt: PromptLifecycleSnapshot | null;
}

export interface RawWireEvent {
  sequence: number;
  stream: "outgoing" | "incoming" | "stderr";
  kind: "request" | "response" | "notification" | "diagnostic";
  payload: string;
  method: string | null;
  requestId: string | null;
  json: unknown;
}

export function createLiveSessionIdentity(
  provider: ProviderId,
  acpSessionId: string,
): LiveSessionIdentity {
  return {
    provider,
    acpSessionId,
  };
}

export function getProviderDescriptor(
  provider: ProviderId,
): ProviderDescriptor {
  return PROVIDER_CATALOG[provider];
}
