type SharedCapabilityStatus = "reserved" | "active";

interface SharedCapabilityRegistration {
  capabilityName: string;
  desktopFeatureRoot: string;
  mobileFeatureRoot: string;
  status: SharedCapabilityStatus;
}

const sharedCapabilityRegistry: SharedCapabilityRegistration[] = [];

export { sharedCapabilityRegistry };
export type { SharedCapabilityRegistration, SharedCapabilityStatus };
