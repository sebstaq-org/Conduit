import {
  createProofSurfaceCopy,
  type ProofSurfaceCopy,
} from "@conduit/design-system-tokens";

export type { ProofSurfaceCopy } from "@conduit/design-system-tokens";

export function createMobileProofSurfaceCopy(): ProofSurfaceCopy {
  return createProofSurfaceCopy("mobile");
}
