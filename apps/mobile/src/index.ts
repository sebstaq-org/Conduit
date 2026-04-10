import { PROVIDER_CATALOG } from "@conduit/provider-catalog";
import { createBootstrapSessionClient } from "@conduit/session-client";
import { createBootstrapSurfaceCopy } from "@conduit/ui";

const sessionClient = createBootstrapSessionClient();

export function createMobileBootstrapPlan() {
  return {
    appId: "mobile",
    copy: createBootstrapSurfaceCopy("mobile"),
    lockedPolicy: sessionClient.policy,
    supportedProviders: Object.keys(PROVIDER_CATALOG),
  };
}
