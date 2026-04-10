type DesignSystemParityStatus = "reserved" | "active";

interface DesignSystemParityRegistration {
  componentName: string;
  desktopExport: string;
  mobileExport: string;
  status: DesignSystemParityStatus;
}

const designSystemParityRegistry: DesignSystemParityRegistration[] = [];

export { designSystemParityRegistry };
export type { DesignSystemParityRegistration, DesignSystemParityStatus };
