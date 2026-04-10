import { PROVIDER_CATALOG } from "@conduit/provider-catalog";
import { createDesktopProofClient } from "@conduit/session-client";
import { createProofSurfaceCopy } from "@conduit/ui";

const sessionClient = createDesktopProofClient();

export function createMobileBootstrapPlan() {
  return {
    appId: "mobile",
    copy: createProofSurfaceCopy("mobile"),
    lockedPolicy: sessionClient.policy,
    supportedProviders: Object.keys(PROVIDER_CATALOG),
  };
}
