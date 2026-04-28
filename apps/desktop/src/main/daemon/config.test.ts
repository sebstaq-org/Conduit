import { afterEach, describe, expect, it } from "vitest";
import { readDesktopDaemonConfig } from "./config.js";

const managedDesktopEnv = {
  CONDUIT_DESKTOP_HOME: "/tmp/conduit-home",
  CONDUIT_DESKTOP_RELAY_ENDPOINT: "http://127.0.0.1:8787/relay",
  CONDUIT_DESKTOP_SERVICE_BIN: "/repo/backend/service-bin",
} as const;
const desktopEnvKeys = [
  "CONDUIT_DESKTOP_APP_BASE_URL",
  "CONDUIT_DESKTOP_BACKEND_HOST",
  "CONDUIT_DESKTOP_BACKEND_LOG_PATH",
  "CONDUIT_DESKTOP_BACKEND_PID_PATH",
  "CONDUIT_DESKTOP_BACKEND_PORT",
  "CONDUIT_DESKTOP_HOME",
  "CONDUIT_DESKTOP_LOG_PROFILE",
  "CONDUIT_DESKTOP_PROVIDER_FIXTURES",
  "CONDUIT_DESKTOP_RELAY_ENDPOINT",
  "CONDUIT_DESKTOP_SERVICE_BIN",
  "CONDUIT_DESKTOP_STORE_PATH",
  "CONDUIT_DESKTOP_WEB_DIR",
  "CONDUIT_FRONTEND_URL",
  "EXPO_PUBLIC_SENTRY_DSN",
] as const;

function withDesktopEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function clearDesktopEnv(): void {
  for (const key of desktopEnvKeys) {
    Reflect.deleteProperty(process.env, key);
  }
}

function withManagedDesktopEnv(): void {
  withDesktopEnv(managedDesktopEnv);
}

function expectManagedUrlConfig(): void {
  expect(readDesktopDaemonConfig()).toMatchObject({
    appBaseUrl: "conduit-dev://pair",
    backendHost: "127.0.0.1",
    backendPort: 4174,
    frontend: {
      kind: "url",
      url: "http://127.0.0.1:8081",
    },
    home: "/tmp/conduit-home",
    logProfile: "dev",
    relayEndpoint: "http://127.0.0.1:8787/relay",
    serviceBinPath: "/repo/backend/service-bin",
    sentryDsn: null,
  });
}

function expectManagedStaticConfig(): void {
  expect(readDesktopDaemonConfig()).toMatchObject({
    appBaseUrl: "conduit://pair",
    frontend: {
      kind: "static",
      webDir: "/repo/stage/web",
    },
    logProfile: "stage",
    sentryDsn: "https://public@example.com/1",
  });
}

describe("desktop daemon config", () => {
  afterEach(() => {
    clearDesktopEnv();
  });

  it("requires managed daemon config instead of allowing a no-daemon desktop", () => {
    // Per user contract: desktop without the managed daemon is forbidden.
    expect(() => readDesktopDaemonConfig()).toThrow(
      "CONDUIT_DESKTOP_HOME is required for the desktop managed daemon",
    );
  });

  it("does not require a feature flag to create the only desktop runtime path", () => {
    withManagedDesktopEnv();
    process.env.CONDUIT_FRONTEND_URL = "http://127.0.0.1:8081";

    expectManagedUrlConfig();
  });

  it("uses static frontend assets as config for the same managed runtime", () => {
    withManagedDesktopEnv();
    process.env.CONDUIT_DESKTOP_LOG_PROFILE = "stage";
    process.env.CONDUIT_DESKTOP_WEB_DIR = "/repo/stage/web";
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.com/1";

    expectManagedStaticConfig();
  });

  it("requires Sentry DSN for stage desktop logging", () => {
    withManagedDesktopEnv();
    process.env.CONDUIT_DESKTOP_LOG_PROFILE = "stage";
    process.env.CONDUIT_DESKTOP_WEB_DIR = "/repo/stage/web";

    expect(() => readDesktopDaemonConfig()).toThrow(
      "EXPO_PUBLIC_SENTRY_DSN is required for stage desktop Sentry logging",
    );
  });
});
