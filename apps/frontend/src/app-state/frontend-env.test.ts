import { afterEach, describe, expect, it } from "vitest";
import { frontendEnvValue } from "./frontend-env";

describe("frontend environment access", () => {
  afterEach(() => {
    delete globalThis.CONDUIT_RUNTIME_CONFIG;
    delete process.env.EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL;
    delete process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE;
    delete process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL;
  });

  it("reads statically referenced Expo environment variables", () => {
    process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL =
      "ws://127.0.0.1:4174/api/session";

    expect(frontendEnvValue("EXPO_PUBLIC_CONDUIT_SESSION_WS_URL")).toBe(
      "ws://127.0.0.1:4174/api/session",
    );
  });

  it("lets packaged stage runtime config override build-time values", () => {
    process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL =
      "ws://127.0.0.1:4174/api/session";
    globalThis.CONDUIT_RUNTIME_CONFIG = {
      clientLogUrl: "http://127.0.0.1:4274/api/client-log",
      logProfile: "stage",
      sessionWsUrl: "ws://127.0.0.1:4274/api/session",
    };

    expect(frontendEnvValue("EXPO_PUBLIC_CONDUIT_SESSION_WS_URL")).toBe(
      "ws://127.0.0.1:4274/api/session",
    );
    expect(frontendEnvValue("EXPO_PUBLIC_CONDUIT_LOG_PROFILE")).toBe("stage");
    expect(frontendEnvValue("EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL")).toBe(
      "http://127.0.0.1:4274/api/client-log",
    );
  });
});
