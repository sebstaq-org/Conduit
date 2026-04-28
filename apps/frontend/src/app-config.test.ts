import type { ConfigContext, ExpoConfig } from "expo/config";
import { afterEach, describe, expect, it } from "vitest";
import createExpoConfig from "../app.config";

function baseExpoConfig(): Partial<ExpoConfig> {
  return {
    android: {
      package: "com.sebstaq.conduit",
    },
    extra: {
      eas: {
        projectId: "test-project",
      },
    },
    ios: {
      buildNumber: "1",
      bundleIdentifier: "com.sebstaq.conduit",
      config: {
        usesNonExemptEncryption: false,
      },
      supportsTablet: false,
    },
    name: "Conduit",
    owner: "sebstaq",
    scheme: "conduit",
    slug: "conduit",
    version: "0.5.0",
  };
}

function configContext(): ConfigContext {
  return {
    config: baseExpoConfig(),
    packageJsonPath: "/tmp/package.json",
    projectRoot: "/tmp/conduit",
    staticConfigPath: "/tmp/app.json",
  };
}

describe("Expo app config", () => {
  afterEach(() => {
    delete process.env.APP_VARIANT;
  });

  it("wires Sentry without committing or packaging an auth token", () => {
    process.env.APP_VARIANT = "stage";
    const config = createExpoConfig(configContext());

    expect(config.plugins).toContainEqual([
      "@sentry/react-native/expo",
      {
        organization: "sebstaq",
        project: "conduit",
        url: "https://sentry.io/",
      },
    ]);
    expect(JSON.stringify(config.plugins)).not.toContain("authToken");
  });

  it("keeps the dev client plugin only for dev builds", () => {
    process.env.APP_VARIANT = "dev";
    const config = createExpoConfig(configContext());

    expect(config.plugins).toContainEqual([
      "expo-dev-client",
      { launchMode: "most-recent" },
    ]);
  });
});
