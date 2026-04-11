export interface ProofSurfaceCopy {
  title: string;
  subtitle: string;
  promptPlaceholder: string;
}

export function createProofSurfaceCopy(
  scope: "desktop" | "frontend",
): ProofSurfaceCopy {
  return {
    title: `Conduit ${scope} ACP proof`,
    subtitle:
      "Official ACP only. This surface drives the locked subset and shows raw wire truth.",
    promptPlaceholder: "Reply with exactly OK.",
  };
}
