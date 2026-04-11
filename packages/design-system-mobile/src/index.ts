import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";

type SessionSurfaceCopy = ProofSurfaceCopy;

function createMobileSessionSurfaceCopy(): SessionSurfaceCopy {
  return createProofSurfaceCopy("mobile");
}

function createMobileProofSurfaceCopy(): ProofSurfaceCopy {
  return createMobileSessionSurfaceCopy();
}

export { createMobileProofSurfaceCopy, createMobileSessionSurfaceCopy };

export type { ProofSurfaceCopy, SessionSurfaceCopy };
