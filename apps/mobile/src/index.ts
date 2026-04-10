import { createDesktopProofClient } from "@conduit/app-client";
import { PROVIDER_CATALOG } from "@conduit/app-core";
import { createMobileProofSurfaceCopy } from "@conduit/design-system-mobile";

const sessionClient = createDesktopProofClient();

export function createMobileBootstrapPlan() {
  return {
    appId: "mobile",
    copy: createMobileProofSurfaceCopy(),
    lockedPolicy: sessionClient.policy,
    supportedProviders: Object.keys(PROVIDER_CATALOG),
  };
}
