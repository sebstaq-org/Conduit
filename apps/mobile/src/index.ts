import { createMobileSessionSurfaceCopy } from "@conduit/design-system-mobile";
import {
  CONSUMER_COMMANDS,
  PROVIDERS,
  createSessionClient,
} from "@conduit/session-client";

const sessionClient = createSessionClient();

export function createMobileBootstrapPlan() {
  return {
    appId: "mobile",
    copy: createMobileSessionSurfaceCopy(),
    lockedPolicy: sessionClient.policy,
    supportedCommands: [...CONSUMER_COMMANDS],
    supportedProviders: [...PROVIDERS],
  };
}
