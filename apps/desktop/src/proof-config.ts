import { DESKTOP_PROOF_ACTIONS, PROVIDERS } from "@conduit/app-client";
import type { DesktopProofConfig } from "@conduit/app-client";
import { createProofSurfaceCopy } from "@conduit/design-system-tokens";

export function createDesktopProofConfig(
  defaultCwd: string,
): DesktopProofConfig {
  return {
    providers: [...PROVIDERS],
    actions: [...DESKTOP_PROOF_ACTIONS],
    defaultCwd,
    copy: createProofSurfaceCopy("desktop"),
  };
}
