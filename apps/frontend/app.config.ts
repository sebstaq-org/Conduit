import type { ConfigContext, ExpoConfig } from "expo/config";

type AppVariant = "stage";
type ExpoPlatform = NonNullable<ExpoConfig["platforms"]>[number];
type ExpoPlugin = NonNullable<ExpoConfig["plugins"]>[number];

function resolveVariant(): AppVariant {
  const rawVariant = process.env.APP_VARIANT;
  if (rawVariant === undefined || rawVariant.trim().length === 0) {
    return "stage";
  }

  const variant = rawVariant.trim().toLowerCase();
  if (variant === "stage") {
    return variant;
  }

  throw new Error(`Unsupported APP_VARIANT: ${rawVariant}. Expected stage.`);
}

function requireString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  throw new Error(`Missing required Expo config string: ${field}`);
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`Missing required Expo config boolean: ${field}`);
}

function readPlatforms(config: ExpoConfig): ExpoPlatform[] {
  if (config.platforms !== undefined) {
    return config.platforms;
  }

  return ["ios", "android", "web"];
}

function isNotDevClientPlugin(plugin: ExpoPlugin): boolean {
  if (Array.isArray(plugin)) {
    const [name] = plugin;
    return name !== "expo-dev-client";
  }

  return plugin !== "expo-dev-client";
}

function readPlugins(config: ExpoConfig): ExpoPlugin[] {
  return (config.plugins ?? []).filter((plugin) =>
    isNotDevClientPlugin(plugin),
  );
}

function createAndroidConfig(
  config: ExpoConfig,
): NonNullable<ExpoConfig["android"]> {
  const androidConfig: NonNullable<ExpoConfig["android"]> = {};

  return Object.assign(androidConfig, config.android, {
    package: requireString(config.android?.package, "android.package"),
  });
}

function createIosEncryptionConfigTarget(): NonNullable<
  NonNullable<ExpoConfig["ios"]>["config"]
> {
  return {};
}

function createIosConfig(config: ExpoConfig): NonNullable<ExpoConfig["ios"]> {
  const iosEncryptionConfig = Object.assign(
    createIosEncryptionConfigTarget(),
    config.ios?.config,
    {
      usesNonExemptEncryption: requireBoolean(
        config.ios?.config?.usesNonExemptEncryption,
        "ios.config.usesNonExemptEncryption",
      ),
    },
  );
  const iosConfig: NonNullable<ExpoConfig["ios"]> = {};

  return Object.assign(iosConfig, config.ios, {
    bundleIdentifier: requireString(
      config.ios?.bundleIdentifier,
      "ios.bundleIdentifier",
    ),
    buildNumber: requireString(config.ios?.buildNumber, "ios.buildNumber"),
    supportsTablet: requireBoolean(
      config.ios?.supportsTablet,
      "ios.supportsTablet",
    ),
    config: iosEncryptionConfig,
  });
}

function createExperimentsConfig(
  config: ExpoConfig,
): NonNullable<ExpoConfig["experiments"]> {
  const experimentsConfig: NonNullable<ExpoConfig["experiments"]> = {};

  return Object.assign(experimentsConfig, config.experiments, {
    typedRoutes: true,
  });
}

function createEasConfigTarget(): NonNullable<ExpoConfig["extra"]> {
  return {};
}

function createExtraConfig(
  config: ExpoConfig,
  variant: AppVariant,
): NonNullable<ExpoConfig["extra"]> {
  const easConfig = Object.assign(createEasConfigTarget(), config.extra?.eas, {
    projectId: requireString(
      config.extra?.eas?.projectId,
      "extra.eas.projectId",
    ),
  });
  const extraConfig: NonNullable<ExpoConfig["extra"]> = {};

  return Object.assign(extraConfig, config.extra, {
    appVariant: variant,
    eas: easConfig,
    router: config.extra?.router ?? {},
  });
}

export default function createExpoConfig({
  config,
}: ConfigContext): ExpoConfig {
  const variant = resolveVariant();
  const expoConfig: ExpoConfig = {};

  return Object.assign(expoConfig, config, {
    name: requireString(config.name, "name"),
    slug: requireString(config.slug, "slug"),
    owner: requireString(config.owner, "owner"),
    version: requireString(config.version, "version"),
    orientation: "portrait",
    platforms: readPlatforms(config),
    scheme: requireString(config.scheme, "scheme"),
    android: createAndroidConfig(config),
    ios: createIosConfig(config),
    plugins: readPlugins(config),
    experiments: createExperimentsConfig(config),
    extra: createExtraConfig(config, variant),
  });
}
