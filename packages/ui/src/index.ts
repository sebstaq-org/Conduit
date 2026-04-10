export interface BootstrapSurfaceCopy {
  title: string;
  subtitle: string;
}

export function createBootstrapSurfaceCopy(
  scope: "desktop" | "mobile",
): BootstrapSurfaceCopy {
  return {
    title: `Conduit ${scope} bootstrap`,
    subtitle:
      "Phase 0.5 reserves structure and policy without implementing runtime behavior.",
  };
}
