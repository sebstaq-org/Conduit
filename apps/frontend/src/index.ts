import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";
import {
  CONSUMER_COMMANDS,
  PROVIDERS,
  createSessionClient,
} from "@conduit/session-client";

const sessionClient = createSessionClient();

interface FrontendBootstrapPlan {
  appId: "frontend";
  copy: ProofSurfaceCopy;
  lockedPolicy: "official-acp-only";
  supportedCommands: string[];
  supportedProviders: string[];
}

export function createFrontendBootstrapPlan(): FrontendBootstrapPlan {
  return {
    appId: "frontend",
    copy: createProofSurfaceCopy("frontend"),
    lockedPolicy: sessionClient.policy,
    supportedCommands: [...CONSUMER_COMMANDS],
    supportedProviders: [...PROVIDERS],
  };
}
