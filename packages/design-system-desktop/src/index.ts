import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";

type SessionSurfaceCopy = ProofSurfaceCopy;

function createDesktopSessionSurfaceCopy(): SessionSurfaceCopy {
  return createProofSurfaceCopy("desktop");
}

function createDesktopProofSurfaceCopy(): ProofSurfaceCopy {
  return createDesktopSessionSurfaceCopy();
}

export { createDesktopProofSurfaceCopy, createDesktopSessionSurfaceCopy };

export type { ProofSurfaceCopy, SessionSurfaceCopy };
