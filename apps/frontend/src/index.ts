import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";
import { createSessionClient } from "@conduit/session-client";
import { PROVIDERS } from "@conduit/session-model";

const sessionClient = createSessionClient();
const supportedSessionClientMethods = [
  "getSessionGroups",
  "openSession",
  "readSessionHistory",
  "promptSession",
  "subscribeSessionIndexChanges",
  "subscribeTimelineChanges",
] as const;

interface FrontendBootstrapPlan {
  appId: "frontend";
  copy: ProofSurfaceCopy;
  lockedPolicy: "official-acp-only";
  supportedClientMethods: string[];
  supportedProviders: string[];
}

export function createFrontendBootstrapPlan(): FrontendBootstrapPlan {
  return {
    appId: "frontend",
    copy: createProofSurfaceCopy("frontend"),
    lockedPolicy: sessionClient.policy,
    supportedClientMethods: [...supportedSessionClientMethods],
    supportedProviders: [...PROVIDERS],
  };
}
