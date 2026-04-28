import { afterEach, describe, expect, it } from "vitest";
import { frontendRuntimeMetadata } from "./frontend-runtime-metadata";

describe("frontend runtime metadata", () => {
  afterEach(() => {
    delete globalThis.CONDUIT_RUNTIME_CONFIG;
  });

  it("marks Electron-hosted frontend logs as desktop runtime", () => {
    globalThis.CONDUIT_RUNTIME_CONFIG = {
      runtimeSurface: "desktop_app",
    };

    expect(frontendRuntimeMetadata()).toEqual({
      runtime_platform: "electron",
      runtime_surface: "desktop_app",
    });
  });

  it("marks non-DOM native runtimes as mobile runtime", () => {
    expect(frontendRuntimeMetadata()).toEqual({
      runtime_platform: "native",
      runtime_surface: "mobile_app",
    });
  });
});
