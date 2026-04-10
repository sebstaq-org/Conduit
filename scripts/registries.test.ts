import { describe, expect, it } from "vitest";

import {
  designSystemParityRegistry,
  type DesignSystemParityRegistration,
} from "./design-system-parity-registry.js";
import {
  sharedCapabilityRegistry,
  type SharedCapabilityRegistration,
} from "./shared-capability-registry.js";

describe("frontend policy registries", () => {
  it("exposes empty design-system parity entries during the foundation pass", () => {
    const entries: DesignSystemParityRegistration[] =
      designSystemParityRegistry;

    expect(entries).toEqual([]);
  });

  it("exposes empty shared capability entries during the foundation pass", () => {
    const entries: SharedCapabilityRegistration[] = sharedCapabilityRegistry;

    expect(entries).toEqual([]);
  });
});
