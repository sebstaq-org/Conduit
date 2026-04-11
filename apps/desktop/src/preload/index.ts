import { createDesktopSessionSurfaceCopy } from "@conduit/design-system-desktop";
import {
  CONSUMER_COMMANDS,
  PROVIDERS,
  createSessionClient,
} from "@conduit/session-client";

interface DesktopBootstrapPlan {
  appId: "desktop";
  copy: ReturnType<typeof createDesktopSessionSurfaceCopy>;
  lockedPolicy: "official-acp-only";
  supportedCommands: string[];
  supportedProviders: string[];
}

export function createDesktopBootstrapPlan(): DesktopBootstrapPlan {
  const sessionClient = createSessionClient();
  return {
    appId: "desktop",
    copy: createDesktopSessionSurfaceCopy(),
    lockedPolicy: sessionClient.policy,
    supportedCommands: [...CONSUMER_COMMANDS],
    supportedProviders: [...PROVIDERS],
  };
}
