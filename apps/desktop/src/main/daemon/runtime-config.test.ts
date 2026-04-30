import { describe, expect, it } from "vitest";
import { createDesktopRuntimeConfig } from "./runtime-config.js";
import type { DesktopDaemonConfig } from "./types.js";

function daemonConfig(sentryDsn: string | null): DesktopDaemonConfig {
  return {
    appBaseUrl: "conduit://pair",
    backendHost: "127.0.0.1",
    backendLogPath: "/tmp/conduit/backend.log",
    backendPidPath: null,
    backendPort: 4274,
    frontend: {
      kind: "static",
      webDir: "/tmp/conduit/web",
    },
    home: "/tmp/conduit",
    logProfile: "stage",
    providerFixtures: null,
    relayEndpoint: "https://relay.example.test",
    serviceBinPath: "/tmp/conduit/service-bin",
    sentryDsn,
    storePath: null,
  };
}

describe("desktop runtime config", () => {
  it("includes runtime Sentry DSN when configured", () => {
    expect(
      createDesktopRuntimeConfig(daemonConfig("https://public@example.com/1")),
    ).toMatchObject({
      clientLogUrl: "http://127.0.0.1:4274/api/client-log",
      logProfile: "stage",
      runtimeSurface: "desktop_app",
      sentryDsn: "https://public@example.com/1",
      sessionWsUrl: "ws://127.0.0.1:4274/api/session",
    });
  });

  it("omits runtime Sentry DSN when not configured", () => {
    expect(createDesktopRuntimeConfig(daemonConfig(null))).not.toHaveProperty(
      "sentryDsn",
    );
  });
});
