import { join } from "node:path";
import type { DesktopDaemonConfig } from "./types.js";

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    return null;
  }
  return value;
}

function requiredEnv(name: string): string {
  const value = envValue(name);
  if (value === null) {
    throw new Error(`${name} is required for the desktop managed daemon`);
  }
  return value;
}

function envPort(name: string, fallback: number): number {
  const value = envValue(name);
  if (value === null) {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a TCP port number.`);
  }
  return port;
}

function logProfile(): DesktopDaemonConfig["logProfile"] {
  const value = envValue("CONDUIT_DESKTOP_LOG_PROFILE");
  if (value === null) {
    return "dev";
  }
  if (value === "dev" || value === "stage") {
    return value;
  }
  throw new Error("CONDUIT_DESKTOP_LOG_PROFILE must be dev or stage");
}

function frontendConfig(): DesktopDaemonConfig["frontend"] {
  const url = envValue("CONDUIT_FRONTEND_URL");
  const webDir = envValue("CONDUIT_DESKTOP_WEB_DIR");
  if (url !== null && webDir !== null) {
    throw new Error(
      "configure either CONDUIT_FRONTEND_URL or CONDUIT_DESKTOP_WEB_DIR, not both",
    );
  }
  if (url !== null) {
    return { kind: "url", url };
  }
  if (webDir !== null) {
    return {
      kind: "static",
      webDir,
    };
  }
  throw new Error(
    "CONDUIT_FRONTEND_URL or CONDUIT_DESKTOP_WEB_DIR is required",
  );
}

function readDesktopDaemonConfig(): DesktopDaemonConfig {
  const home = requiredEnv("CONDUIT_DESKTOP_HOME");
  return {
    appBaseUrl: envValue("CONDUIT_DESKTOP_APP_BASE_URL") ?? "conduit://pair",
    backendHost: envValue("CONDUIT_DESKTOP_BACKEND_HOST") ?? "127.0.0.1",
    backendLogPath:
      envValue("CONDUIT_DESKTOP_BACKEND_LOG_PATH") ??
      join(home, "desktop-backend.log"),
    backendPidPath: envValue("CONDUIT_DESKTOP_BACKEND_PID_PATH"),
    backendPort: envPort("CONDUIT_DESKTOP_BACKEND_PORT", 4174),
    frontend: frontendConfig(),
    home,
    logProfile: logProfile(),
    providerFixtures: envValue("CONDUIT_DESKTOP_PROVIDER_FIXTURES"),
    relayEndpoint: requiredEnv("CONDUIT_DESKTOP_RELAY_ENDPOINT"),
    serviceBinPath: requiredEnv("CONDUIT_DESKTOP_SERVICE_BIN"),
    storePath: envValue("CONDUIT_DESKTOP_STORE_PATH"),
  };
}

export { readDesktopDaemonConfig };
