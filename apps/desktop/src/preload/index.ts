import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";
import { PROVIDERS, createSessionClient } from "@conduit/session-client";

const supportedSessionClientMethods = ["getSessionGroups"] as const;

interface DesktopBootstrapPlan {
  appId: "desktop";
  copy: ProofSurfaceCopy;
  lockedPolicy: "official-acp-only";
  supportedClientMethods: string[];
  supportedProviders: string[];
}

export function createDesktopBootstrapPlan(): DesktopBootstrapPlan {
  const sessionClient = createSessionClient();
  return {
    appId: "desktop",
    copy: createProofSurfaceCopy("desktop"),
    lockedPolicy: sessionClient.policy,
    supportedClientMethods: [...supportedSessionClientMethods],
    supportedProviders: [...PROVIDERS],
  };
}
