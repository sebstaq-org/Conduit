export type DesignSystemParityStatus = "reserved" | "active";

export interface DesignSystemParityRegistration {
  componentName: string;
  desktopExport: string;
  mobileExport: string;
  status: DesignSystemParityStatus;
}

export const designSystemParityRegistry: DesignSystemParityRegistration[] = [];
