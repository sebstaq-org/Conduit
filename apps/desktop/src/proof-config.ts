import {
  DESKTOP_PROOF_ACTIONS,
  type DesktopProofConfig,
} from "@conduit/app-client";
import { createDesktopProofSurfaceCopy } from "@conduit/design-system-desktop";
import { PROVIDERS } from "@conduit/session-model";

export function createDesktopProofConfig(
  defaultCwd: string,
): DesktopProofConfig {
  return {
    providers: [...PROVIDERS],
    actions: [...DESKTOP_PROOF_ACTIONS],
    defaultCwd,
    copy: createDesktopProofSurfaceCopy(),
  };
}
