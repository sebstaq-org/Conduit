import type { DesktopProofConfig } from "@conduit/app-client";
import { DESKTOP_ACTIONS, PROVIDER_CATALOG } from "@conduit/app-core";
import { createDesktopProofSurfaceCopy } from "@conduit/design-system-desktop";

export function createDesktopProofConfig(
  defaultCwd: string,
): DesktopProofConfig {
  return {
    providers: Object.keys(PROVIDER_CATALOG) as DesktopProofConfig["providers"],
    actions: [...DESKTOP_ACTIONS],
    defaultCwd,
    copy: createDesktopProofSurfaceCopy(),
  };
}
