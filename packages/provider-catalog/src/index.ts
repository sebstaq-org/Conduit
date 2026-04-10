import type { ProviderId } from "@conduit/session-model";

export interface ProviderDescriptor {
  id: ProviderId;
  launcher: string;
  authSource: "local-login-state";
  phaseStatus: "bootstrap-only";
}

export const PROVIDER_CATALOG = {
  claude: {
    id: "claude",
    launcher: "claude-agent-acp",
    authSource: "local-login-state",
    phaseStatus: "bootstrap-only",
  },
  codex: {
    id: "codex",
    launcher: "codex-acp",
    authSource: "local-login-state",
    phaseStatus: "bootstrap-only",
  },
  copilot: {
    id: "copilot",
    launcher: "copilot --acp --allow-all --no-color --no-auto-update",
    authSource: "local-login-state",
    phaseStatus: "bootstrap-only",
  },
} as const satisfies Record<ProviderId, ProviderDescriptor>;

export function getProviderDescriptor(
  provider: ProviderId,
): ProviderDescriptor {
  return PROVIDER_CATALOG[provider];
}
