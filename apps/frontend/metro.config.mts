import { getDefaultConfig } from "expo/metro-config.js";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getBundleModeMetroConfig } from "react-native-worklets/bundleMode/index.js";

const projectRoot = import.meta.dirname;
const require = createRequire(import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBundleModeEnabled(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const worklets = value.worklets;
  if (!isRecord(worklets)) {
    return false;
  }

  const staticFeatureFlags = worklets.staticFeatureFlags;
  if (!isRecord(staticFeatureFlags)) {
    return false;
  }

  return staticFeatureFlags.BUNDLE_MODE_ENABLED === true;
}

const config = getDefaultConfig(projectRoot);
const packageJson: unknown = require("./package.json");
const isBundleModeEnabled = readBundleModeEnabled(packageJson);
const workletsModulePath = path.join("react-native-worklets", ".worklets");

if (isBundleModeEnabled) {
  const workletsPackagePath = path.dirname(
    require.resolve("react-native-worklets/package.json"),
  );
  const workletsOutputPath = path.resolve(workletsPackagePath, ".worklets");

  mkdirSync(workletsOutputPath, { recursive: true });
  config.watchFolders.push(workletsOutputPath);
}

const defaultResolveRequest = config.resolver.resolveRequest;

function createMetroConfig(): typeof config {
  if (isBundleModeEnabled) {
    return getBundleModeMetroConfig(config);
  }

  return config;
}

function readBundleModeResolveRequest(
  currentConfig: typeof config,
): NonNullable<typeof config.resolver.resolveRequest> | undefined {
  if (!isBundleModeEnabled) {
    return undefined;
  }

  return currentConfig.resolver.resolveRequest;
}

const metroConfig = createMetroConfig();
const bundleModeResolveRequest = readBundleModeResolveRequest(metroConfig);

function resolveDefault(
  context: Parameters<NonNullable<typeof defaultResolveRequest>>[0],
  moduleName: string,
  platform: string | null,
): unknown {
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
}

function resolveTypeScriptSourceImport(
  context: Parameters<NonNullable<typeof defaultResolveRequest>>[0],
  requestName: string,
  platform: string | null,
): unknown {
  if (!requestName.startsWith(".") || !requestName.endsWith(".js")) {
    return null;
  }
  const withoutExtension = requestName.slice(0, -".js".length);
  for (const extension of [".ts", ".tsx"] as const) {
    try {
      return resolveDefault(
        context,
        `${withoutExtension}${extension}`,
        platform,
      );
    } catch {
      // Try the next TypeScript source extension.
    }
  }
  return null;
}

const resolveTypeScriptSourceRequest = (
  originModulePath: string,
  requestName: string,
): unknown => {
  if (!requestName.startsWith(".") || !requestName.endsWith(".js")) {
    return undefined;
  }

  const sourceRequestPath = path.resolve(
    path.dirname(originModulePath),
    requestName.slice(0, -".js".length),
  );
  const sourceFilePath = `${sourceRequestPath}.ts`;
  const sourceFileExists: boolean = existsSync(sourceFilePath);

  if (!sourceFileExists) {
    return undefined;
  }

  return { type: "sourceFile", filePath: sourceFilePath };
};

const resolveWithTypeScriptExtensionFallback: ResolveRequest = (
  context,
  moduleName,
  platform,
) => {
  const requestName = String(moduleName);

  try {
    return resolveDefault(context, requestName, platform);
  } catch (error) {
    const sourceImport = resolveTypeScriptSourceImport(
      context,
      requestName,
      platform,
    );
    if (sourceImport !== null) {
      return sourceImport;
    }
    throw error;
  }
};

metroConfig.resolver.resolveRequest = (
  context,
  moduleName,
  platform,
): unknown => {
  const requestName = String(moduleName);
  const sourceRequest = resolveTypeScriptSourceRequest(
    String(context.originModulePath),
    requestName,
  );

  if (sourceRequest !== undefined) {
    return sourceRequest;
  }

  if (
    isBundleModeEnabled &&
    bundleModeResolveRequest !== undefined &&
    requestName.startsWith(workletsModulePath)
  ) {
    return bundleModeResolveRequest(context, moduleName, platform);
  }

  return resolveWithTypeScriptExtensionFallback(context, moduleName, platform);
};

// oxlint-disable-next-line import/no-default-export -- Metro config loader requires a default config value.
export default metroConfig;
