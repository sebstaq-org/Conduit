import { PROVIDER_CATALOG } from "@conduit/provider-catalog";
import { createProofSurfaceCopy } from "@conduit/ui";

export function createDesktopProofPlan() {
  return {
    appId: "desktop",
    copy: createProofSurfaceCopy("desktop"),
    supportedProviders: Object.keys(PROVIDER_CATALOG),
  };
}
