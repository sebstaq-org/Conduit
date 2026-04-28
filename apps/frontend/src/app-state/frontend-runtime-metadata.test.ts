import { afterEach, describe, expect, it, vi } from "vitest";
import { frontendRuntimeMetadata } from "./frontend-runtime-metadata";

function expectDesktopRuntimeMetadata(): void {
  globalThis.CONDUIT_RUNTIME_CONFIG = {
    runtimeSurface: "desktop_app",
  };

  expect(frontendRuntimeMetadata()).toEqual({
    runtime_platform: "electron",
    runtime_surface: "desktop_app",
  });
}

function expectReactNativeRuntimeMetadata(): void {
  vi.stubGlobal("navigator", { product: "ReactNative" });

  expect(frontendRuntimeMetadata()).toEqual({
    runtime_platform: "native",
    runtime_surface: "mobile_app",
  });
}

function expectWebRuntimeMetadata(): void {
  vi.stubGlobal("document", {});

  expect(frontendRuntimeMetadata()).toEqual({
    runtime_platform: "web",
    runtime_surface: "web_app",
  });
}

function expectUnknownRuntimeFailure(): void {
  expect(() => frontendRuntimeMetadata()).toThrow(
    "Unable to determine Conduit frontend runtime surface.",
  );
}

function expectUnsupportedRuntimeFailure(): void {
  globalThis.CONDUIT_RUNTIME_CONFIG = {
    runtimeSurface: "mobile_app",
  };

  expect(() => frontendRuntimeMetadata()).toThrow(
    "Unsupported Conduit runtime surface: mobile_app",
  );
}

describe("frontend runtime metadata", () => {
  afterEach(() => {
    delete globalThis.CONDUIT_RUNTIME_CONFIG;
    vi.unstubAllGlobals();
  });

  it(
    "marks Electron-hosted frontend logs as desktop runtime",
    expectDesktopRuntimeMetadata,
  );
  it(
    "marks React Native runtimes as mobile runtime",
    expectReactNativeRuntimeMetadata,
  );
  it(
    "marks DOM runtimes without desktop config as web runtime",
    expectWebRuntimeMetadata,
  );
  it(
    "fails fast when no explicit runtime can be identified",
    expectUnknownRuntimeFailure,
  );
  it("fails fast on unsupported configured runtime surfaces", () => {
    expectUnsupportedRuntimeFailure();
  });
});
