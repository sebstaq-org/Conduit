import { app, BrowserWindow, dialog } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StageBackend } from "./backend.js";
import { readStageRuntimeConfig } from "./config.js";
import { waitForBackendHealth, waitForWebHealth } from "./health.js";
import { closeStaticServer, startStaticServer } from "./static-server.js";
import {
  failedService,
  healthyService,
  prepareStageDirectories,
  startingService,
  stoppedService,
  writeRuntimeStatus,
} from "./status.js";
import type { Server } from "node:http";
import type { StageRuntimeConfig, StageRuntimeState } from "./types.js";

const stageState: StageRuntimeState = {
  server: null,
  shutdownComplete: false,
  shutdownStarted: false,
  windows: new Set<BrowserWindow>(),
};

let stageBackend: StageBackend | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function requiredBackend(): StageBackend {
  if (stageBackend === null) {
    throw new Error("stage backend is not initialized.");
  }
  return stageBackend;
}

function stageUrl(config: StageRuntimeConfig): string {
  return `http://${config.webHost}:${String(config.webPort)}/?v=${String(Date.now())}`;
}

function createStageWindow(config: StageRuntimeConfig): BrowserWindow {
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    height: 900,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, "../../preload/index.cjs"),
      sandbox: true,
    },
    width: 1440,
  });
  stageState.windows.add(mainWindow);
  mainWindow.once("closed", () => {
    stageState.windows.delete(mainWindow);
  });
  void mainWindow.loadURL(stageUrl(config));
  return mainWindow;
}

function writeElectronPid(config: StageRuntimeConfig): void {
  mkdirSync(config.logDir, { recursive: true });
  writeFileSync(config.electronPidPath, String(process.pid), "utf8");
}

function finishStageShutdown(config: StageRuntimeConfig, code: number): void {
  writeRuntimeStatus(config, {
    backend: stoppedService("backend stopped"),
    web: stoppedService("web stopped"),
  });
  stageState.shutdownComplete = true;
  app.exit(code);
}

function shutdownStageRuntime(config: StageRuntimeConfig, code: number): void {
  let pending = 2;
  const done = (): void => {
    pending -= 1;
    if (pending === 0) {
      finishStageShutdown(config, code);
    }
  };
  closeStaticServer(stageState.server, done);
  const backend = stageBackend;
  if (backend === null) {
    done();
    return;
  }
  backend.stop(done);
}

function requestStageQuit(config: StageRuntimeConfig, code: number): void {
  if (stageState.shutdownStarted) {
    return;
  }
  stageState.shutdownStarted = true;
  shutdownStageRuntime(config, code);
}

function bindStageAppLifecycle(config: StageRuntimeConfig): void {
  app.on("window-all-closed", () => {
    requestStageQuit(config, 0);
  });
  app.on("before-quit", (event) => {
    if (!stageState.shutdownComplete) {
      event.preventDefault();
      requestStageQuit(config, 0);
    }
  });
  process.once("SIGTERM", () => {
    requestStageQuit(config, 0);
  });
  process.once("SIGINT", () => {
    requestStageQuit(config, 0);
  });
}

function handleStartupFailure(
  config: StageRuntimeConfig,
  error: unknown,
): void {
  const message = errorMessage(error);
  writeRuntimeStatus(config, {
    backend: failedService(message),
    web: failedService(message),
  });
  dialog.showErrorBox("Conduit Stage failed to start", message);
  requestStageQuit(config, 1);
}

function markRuntimeHealthy(config: StageRuntimeConfig): void {
  createStageWindow(config);
  writeRuntimeStatus(config, {
    backend: healthyService("backend healthy", requiredBackend().pid),
    web: healthyService("web healthy", null),
  });
}

function handleRuntimeHealthFailure(
  config: StageRuntimeConfig,
  error: Error,
): void {
  handleStartupFailure(config, error);
}

function handleBackendHealthy(config: StageRuntimeConfig): void {
  waitForWebHealth({
    config,
    onFailure: handleRuntimeHealthFailure.bind(undefined, config),
    onSuccess: markRuntimeHealthy.bind(undefined, config),
  });
}

function waitForRuntimeHealth(config: StageRuntimeConfig): void {
  waitForBackendHealth({
    backend: requiredBackend(),
    config,
    onFailure: handleRuntimeHealthFailure.bind(undefined, config),
    onSuccess: handleBackendHealthy.bind(undefined, config),
  });
}

function handleStaticServerReady(
  config: StageRuntimeConfig,
  server: Server,
): void {
  stageState.server = server;
  waitForRuntimeHealth(config);
}

function startStageRuntime(config: StageRuntimeConfig): void {
  stageBackend = new StageBackend(config, (message) => {
    writeRuntimeStatus(config, {
      backend: failedService(message),
      web: healthyService("web stayed up until backend exit", null),
    });
  });
  prepareStageDirectories(config);
  writeElectronPid(config);
  writeRuntimeStatus(config, {
    backend: startingService("starting backend"),
    web: startingService("starting web"),
  });
  stageBackend.start();
  const handleReady = (server: Server): void => {
    handleStaticServerReady(config, server);
  };
  startStaticServer(
    config,
    handleReady,
    handleStartupFailure.bind(undefined, config),
  );
}

function runStageRuntimeIfConfigured(): boolean {
  const config = readStageRuntimeConfig();
  if (config === null) {
    return false;
  }
  bindStageAppLifecycle(config);
  if (app.isReady()) {
    startStageRuntime(config);
    return true;
  }
  app.on("ready", () => {
    startStageRuntime(config);
  });
  return true;
}

export { runStageRuntimeIfConfigured };
