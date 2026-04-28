type FrontendRuntimeSurface = "desktop_app" | "mobile_app" | "web_app";
type FrontendRuntimePlatform = "electron" | "native" | "web";

interface FrontendRuntimeMetadata {
  readonly runtime_platform: FrontendRuntimePlatform;
  readonly runtime_surface: FrontendRuntimeSurface;
}

function configuredRuntimeSurface(): string | undefined {
  return globalThis.CONDUIT_RUNTIME_CONFIG?.runtimeSurface;
}

function isReactNativeRuntime(): boolean {
  const navigatorValue = globalThis.navigator as
    | { readonly product?: string }
    | undefined;
  return navigatorValue?.product === "ReactNative";
}

function runtimeSurface(): FrontendRuntimeSurface {
  const configuredSurface = configuredRuntimeSurface();
  if (configuredSurface === "desktop_app") {
    return configuredSurface;
  }
  if (isReactNativeRuntime() || globalThis.document === undefined) {
    return "mobile_app";
  }
  return "web_app";
}

function runtimePlatform(
  surface: FrontendRuntimeSurface,
): FrontendRuntimePlatform {
  if (surface === "desktop_app") {
    return "electron";
  }
  if (surface === "mobile_app") {
    return "native";
  }
  return "web";
}

function frontendRuntimeMetadata(): FrontendRuntimeMetadata {
  const surface = runtimeSurface();
  return {
    runtime_platform: runtimePlatform(surface),
    runtime_surface: surface,
  };
}

export { frontendRuntimeMetadata };
export type { FrontendRuntimeMetadata };
