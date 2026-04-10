import {
  createProofSurfaceCopy,
  type ProofSurfaceCopy,
} from "@conduit/design-system-tokens";

export type { ProofSurfaceCopy } from "@conduit/design-system-tokens";

export type SessionSurfaceCopy = ProofSurfaceCopy;

export function createDesktopSessionSurfaceCopy(): SessionSurfaceCopy {
  return createProofSurfaceCopy("desktop");
}

export function createDesktopProofSurfaceCopy(): ProofSurfaceCopy {
  return createDesktopSessionSurfaceCopy();
}
