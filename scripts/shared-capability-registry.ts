export type SharedCapabilityStatus = "reserved" | "active";

export interface SharedCapabilityRegistration {
  capabilityName: string;
  desktopFeatureRoot: string;
  mobileFeatureRoot: string;
  status: SharedCapabilityStatus;
}

export const sharedCapabilityRegistry: SharedCapabilityRegistration[] = [];
