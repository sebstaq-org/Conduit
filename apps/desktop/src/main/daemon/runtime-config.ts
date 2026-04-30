import type { DesktopDaemonConfig, DesktopRuntimeConfig } from "./types.js";

function createDesktopRuntimeConfig(
  config: DesktopDaemonConfig,
): DesktopRuntimeConfig {
  const runtimeConfig: DesktopRuntimeConfig = {
    clientLogUrl: `http://${config.backendHost}:${String(config.backendPort)}/api/client-log`,
    logProfile: config.logProfile,
    runtimeSurface: "desktop_app",
    sessionWsUrl: `ws://${config.backendHost}:${String(config.backendPort)}/api/session`,
  };
  if (config.sentryDsn === null) {
    return runtimeConfig;
  }
  return Object.assign(runtimeConfig, { sentryDsn: config.sentryDsn });
}

export { createDesktopRuntimeConfig };
