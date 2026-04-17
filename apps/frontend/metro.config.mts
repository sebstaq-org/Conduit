import { getDefaultConfig } from "expo/metro-config.js";
import { mkdirSync } from "node:fs";
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
type ResolveRequest = NonNullable<typeof metroConfig.resolver.resolveRequest>;

const isRelativeJavaScriptRequest = (requestName: string): boolean =>
  requestName.startsWith(".") && requestName.endsWith(".js");

const resolveWithDefaultFallback: ResolveRequest = (
  context,
  moduleName,
  platform,
) => {
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

metroConfig.resolver.resolveRequest = (
  context,
  moduleName,
  platform,
): unknown => {
  const requestName = String(moduleName);

  if (requestName.startsWith(workletsModulePath)) {
    return bundleModeResolveRequest(context, moduleName, platform);
  }

  try {
    return resolveWithDefaultFallback(context, moduleName, platform);
  } catch (error) {
    if (!isRelativeJavaScriptRequest(requestName)) {
      throw error;
    }

    return resolveWithDefaultFallback(
      context,
      requestName.replace(/\.js$/u, ".ts"),
      platform,
    );
  }
};

// oxlint-disable-next-line import/no-default-export -- Metro config loader requires a default config value.
export default metroConfig;
