import type { ConfigContext, ExpoConfig } from "expo/config";

type AppVariant = "dev" | "stage";
type ExpoPlatform = NonNullable<ExpoConfig["platforms"]>[number];
type ExpoPlugin = NonNullable<ExpoConfig["plugins"]>[number];

function resolveVariant(): AppVariant {
  const rawVariant = process.env.APP_VARIANT;
  if (rawVariant === undefined || rawVariant.trim().length === 0) {
    return "stage";
  }

  const variant = rawVariant.trim().toLowerCase();
  if (variant === "dev" || variant === "stage") {
    return variant;
  }

  throw new Error(
    `Unsupported APP_VARIANT: ${rawVariant}. Expected dev or stage.`,
  );
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

function readPlatforms(config: Partial<ExpoConfig>): ExpoPlatform[] {
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

function isNotSentryPlugin(plugin: ExpoPlugin): boolean {
  if (Array.isArray(plugin)) {
    const [name] = plugin;
    return (
      name !== "@sentry/react-native" && name !== "@sentry/react-native/expo"
    );
  }

  return (
    plugin !== "@sentry/react-native" && plugin !== "@sentry/react-native/expo"
  );
}

function sentryPlugin(): ExpoPlugin {
  return [
    "@sentry/react-native/expo",
    {
      organization: "sebstaq",
      project: "conduit",
      url: "https://sentry.io/",
    },
  ];
}

function readPlugins(
  config: Partial<ExpoConfig>,
  variant: AppVariant,
): ExpoPlugin[] {
  const plugins = (config.plugins ?? [])
    .filter((plugin) => isNotDevClientPlugin(plugin))
    .filter((plugin) => isNotSentryPlugin(plugin));

  if (variant !== "dev") {
    return [...plugins, sentryPlugin()];
  }

  return [
    ...plugins,
    sentryPlugin(),
    ["expo-dev-client", { launchMode: "most-recent" }],
  ];
}

function androidPackageForVariant(
  packageName: string,
  variant: AppVariant,
): string {
  if (variant === "dev") {
    return `${packageName}.dev`;
  }

  return packageName;
}

function createAndroidConfig(
  config: Partial<ExpoConfig>,
  variant: AppVariant,
): NonNullable<ExpoConfig["android"]> {
  const androidConfig: NonNullable<ExpoConfig["android"]> = {};
  const packageName = requireString(config.android?.package, "android.package");

  return Object.assign(androidConfig, config.android, {
    package: androidPackageForVariant(packageName, variant),
  });
}

function iosBundleIdentifierForVariant(
  bundleIdentifier: string,
  variant: AppVariant,
): string {
  if (variant === "dev") {
    return `${bundleIdentifier}.dev`;
  }

  return bundleIdentifier;
}

function createIosEncryptionConfigTarget(): NonNullable<
  NonNullable<ExpoConfig["ios"]>["config"]
> {
  return {};
}

function createIosConfig(
  config: Partial<ExpoConfig>,
  variant: AppVariant,
): NonNullable<ExpoConfig["ios"]> {
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
  const bundleIdentifier = requireString(
    config.ios?.bundleIdentifier,
    "ios.bundleIdentifier",
  );

  return Object.assign(iosConfig, config.ios, {
    bundleIdentifier: iosBundleIdentifierForVariant(bundleIdentifier, variant),
    buildNumber: requireString(config.ios?.buildNumber, "ios.buildNumber"),
    supportsTablet: requireBoolean(
      config.ios?.supportsTablet,
      "ios.supportsTablet",
    ),
    config: iosEncryptionConfig,
  });
}

function createExperimentsConfig(
  config: Partial<ExpoConfig>,
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
  config: Partial<ExpoConfig>,
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

function appNameForVariant(
  config: Partial<ExpoConfig>,
  variant: AppVariant,
): string {
  if (variant === "dev") {
    return "Conduit (Dev)";
  }

  return requireString(config.name, "name");
}

function schemeForVariant(scheme: string, variant: AppVariant): string {
  if (variant === "dev") {
    return `${scheme}-dev`;
  }

  return scheme;
}

export default function createExpoConfig({
  config,
}: ConfigContext): ExpoConfig {
  const variant = resolveVariant();
  const scheme = requireString(config.scheme, "scheme");
  const expoConfig: Partial<ExpoConfig> = {};

  return Object.assign(expoConfig, config, {
    name: appNameForVariant(config, variant),
    slug: requireString(config.slug, "slug"),
    owner: requireString(config.owner, "owner"),
    version: requireString(config.version, "version"),
    orientation: "portrait",
    platforms: readPlatforms(config),
    scheme: schemeForVariant(scheme, variant),
    android: createAndroidConfig(config, variant),
    ios: createIosConfig(config, variant),
    plugins: readPlugins(config, variant),
    experiments: createExperimentsConfig(config),
    extra: createExtraConfig(config, variant),
  }) as ExpoConfig;
}
