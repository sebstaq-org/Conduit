import { createMobileSessionSurfaceCopy } from "@conduit/design-system-mobile";
import {
  CONSUMER_COMMANDS,
  PROVIDERS,
  createSessionClient,
} from "@conduit/session-client";

const sessionClient = createSessionClient();

interface MobileBootstrapPlan {
  appId: "mobile";
  copy: ReturnType<typeof createMobileSessionSurfaceCopy>;
  lockedPolicy: "official-acp-only";
  supportedCommands: string[];
  supportedProviders: string[];
}

export function createMobileBootstrapPlan(): MobileBootstrapPlan {
  return {
    appId: "mobile",
    copy: createMobileSessionSurfaceCopy(),
    lockedPolicy: sessionClient.policy,
    supportedCommands: [...CONSUMER_COMMANDS],
    supportedProviders: [...PROVIDERS],
  };
}
