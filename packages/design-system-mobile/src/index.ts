import {
  createProofSurfaceCopy,
  type ProofSurfaceCopy,
} from "@conduit/design-system-tokens";

export type { ProofSurfaceCopy } from "@conduit/design-system-tokens";

export type SessionSurfaceCopy = ProofSurfaceCopy;

export function createMobileSessionSurfaceCopy(): SessionSurfaceCopy {
  return createProofSurfaceCopy("mobile");
}

export function createMobileProofSurfaceCopy(): ProofSurfaceCopy {
  return createMobileSessionSurfaceCopy();
}
