import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";
import {
  CONSUMER_COMMANDS,
  PROVIDERS,
  createSessionClient,
} from "@conduit/session-client";

interface DesktopBootstrapPlan {
  appId: "desktop";
  copy: ProofSurfaceCopy;
  lockedPolicy: "official-acp-only";
  supportedCommands: string[];
  supportedProviders: string[];
}

export function createDesktopBootstrapPlan(): DesktopBootstrapPlan {
  const sessionClient = createSessionClient();
  return {
    appId: "desktop",
    copy: createProofSurfaceCopy("desktop"),
    lockedPolicy: sessionClient.policy,
    supportedCommands: [...CONSUMER_COMMANDS],
    supportedProviders: [...PROVIDERS],
  };
}
