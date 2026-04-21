import { app } from "electron";
import { join } from "node:path";
import type { StageRuntimeConfig } from "./types.js";

const defaultBackendPort = 4274;
const defaultWebPort = 4310;
const stageResourcesDirectoryName = "stage-resources";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required for stage runtime.`);
  }
  return value;
}

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  return value;
}

function envPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a TCP port number.`);
  }
  return port;
}

function serviceBinPath(resourcesDir: string): string {
  let extension = "";
  if (process.platform === "win32") {
    extension = ".exe";
  }
  return join(resourcesDir, "bin", `service-bin${extension}`);
}

function readResourcesDir(): string {
  const configuredResourcesDir = process.env.CONDUIT_STAGE_RESOURCES_DIR;
  if (
    configuredResourcesDir !== undefined &&
    configuredResourcesDir.trim().length > 0
  ) {
    return configuredResourcesDir;
  }
  if (!app.isPackaged) {
    throw new Error(
      "CONDUIT_STAGE_RESOURCES_DIR is required for unpackaged stage runtime.",
    );
  }
  return join(process.resourcesPath, stageResourcesDirectoryName);
}

function readStageRuntimeConfig(): StageRuntimeConfig | null {
  if (process.env.CONDUIT_STAGE_RUNTIME !== "1") {
    return null;
  }
  const pidDir = requiredEnv("CONDUIT_STAGE_PID_DIR");
  const logDir = requiredEnv("CONDUIT_STAGE_LOG_DIR");
  const dataRoot = requiredEnv("CONDUIT_STAGE_DATA_ROOT");
  const resourcesDir = readResourcesDir();
  const backendHost = envValue("CONDUIT_STAGE_BACKEND_HOST", "127.0.0.1");
  const backendPort = envPort("CONDUIT_STAGE_BACKEND_PORT", defaultBackendPort);
  return {
    backendHost,
    backendLogBasePath: join(dataRoot, "logs", "backend.log"),
    backendPidPath: join(pidDir, "backend.pid"),
    backendPort,
    dataRoot,
    electronPidPath: join(pidDir, "electron.pid"),
    frontendLogPath: join(logDir, "frontend.log"),
    logDir,
    resourcesDir,
    serviceBinPath: serviceBinPath(resourcesDir),
    statusPath: requiredEnv("CONDUIT_STAGE_STATUS_FILE"),
    webDir: join(resourcesDir, "web"),
    webHost: envValue("CONDUIT_STAGE_WEB_HOST", "127.0.0.1"),
    webPort: envPort("CONDUIT_STAGE_WEB_PORT", defaultWebPort),
  };
}

export { readStageRuntimeConfig, stageResourcesDirectoryName };
