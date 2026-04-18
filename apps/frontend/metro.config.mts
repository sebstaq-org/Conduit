import { getDefaultConfig } from "expo/metro-config.js";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getBundleModeMetroConfig } from "react-native-worklets/bundleMode/index.js";

const projectRoot = import.meta.dirname;
const require = createRequire(import.meta.url);
const config = getDefaultConfig(projectRoot);
const workletsPackagePath = path.dirname(
  require.resolve("react-native-worklets/package.json"),
);
const workletsOutputPath = path.resolve(workletsPackagePath, ".worklets");
const workletsModulePath = path.join("react-native-worklets", ".worklets");

mkdirSync(workletsOutputPath, { recursive: true });
config.watchFolders.push(workletsOutputPath);

const defaultResolveRequest = config.resolver.resolveRequest;
const metroConfig = getBundleModeMetroConfig(config);
const bundleModeResolveRequest = metroConfig.resolver.resolveRequest;

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

  if (requestName.startsWith(workletsModulePath)) {
    return bundleModeResolveRequest(context, moduleName, platform);
  }

  return resolveWithTypeScriptExtensionFallback(context, moduleName, platform);
};

// oxlint-disable-next-line import/no-default-export -- Metro config loader requires a default config value.
export default metroConfig;
