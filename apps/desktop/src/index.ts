import { createDesktopSessionSurfaceCopy } from "@conduit/design-system-desktop";
import {
  CONSUMER_COMMANDS,
  PROVIDERS,
  createSessionClient,
} from "@conduit/session-client";

export function createDesktopBootstrapPlan() {
  const sessionClient = createSessionClient();
  return {
    appId: "desktop",
    copy: createDesktopSessionSurfaceCopy(),
    lockedPolicy: sessionClient.policy,
    supportedCommands: [...CONSUMER_COMMANDS],
    supportedProviders: [...PROVIDERS],
  };
}
