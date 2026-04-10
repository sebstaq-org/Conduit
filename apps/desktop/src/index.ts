import { PROVIDER_CATALOG } from "@conduit/app-core";
import { createDesktopProofSurfaceCopy } from "@conduit/design-system-desktop";

export function createDesktopProofPlan() {
  return {
    appId: "desktop",
    copy: createDesktopProofSurfaceCopy(),
    supportedProviders: Object.keys(PROVIDER_CATALOG),
  };
}
