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
    throw new Error(`${name} is required when CONDUIT_DESKTOP_DAEMON=1`);
  }
  return value;
}

function readDesktopDaemonConfig(): DesktopDaemonConfig | null {
  if (process.env.CONDUIT_DESKTOP_DAEMON !== "1") {
    return null;
  }
  const home = requiredEnv("CONDUIT_DESKTOP_HOME");
  return {
    appBaseUrl: envValue("CONDUIT_DESKTOP_APP_BASE_URL") ?? "conduit://pair",
    backendHost: envValue("CONDUIT_DESKTOP_BACKEND_HOST") ?? "127.0.0.1",
    backendLogPath:
      envValue("CONDUIT_DESKTOP_BACKEND_LOG_PATH") ??
      join(home, "desktop-backend.log"),
    backendPort: Number(envValue("CONDUIT_DESKTOP_BACKEND_PORT") ?? "4174"),
    home,
    providerFixtures: envValue("CONDUIT_DESKTOP_PROVIDER_FIXTURES"),
    relayEndpoint: requiredEnv("CONDUIT_DESKTOP_RELAY_ENDPOINT"),
    serviceBinPath: requiredEnv("CONDUIT_DESKTOP_SERVICE_BIN"),
    storePath: envValue("CONDUIT_DESKTOP_STORE_PATH"),
  };
}

export { readDesktopDaemonConfig };
