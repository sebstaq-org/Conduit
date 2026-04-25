import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { DesktopDaemonController } from "./daemon/backend.js";
import { readDesktopDaemonConfig } from "./daemon/config.js";
import { bindDesktopDaemonIpc } from "./daemon/ipc.js";
import { runStageRuntimeIfConfigured } from "./stage/runtime.js";
import type { DesktopDaemonConfig } from "./daemon/types.js";

const currentDirectory = import.meta.dirname;
const mainWindows = new Set<BrowserWindow>();
let desktopShutdownComplete = false;
let desktopShutdownStarted = false;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

app.disableHardwareAcceleration();

const runningStageRuntime = runStageRuntimeIfConfigured();
let desktopDaemonConfig: DesktopDaemonConfig | null = null;
let desktopStartupError: string | null = null;
if (!runningStageRuntime) {
  try {
    desktopDaemonConfig = readDesktopDaemonConfig();
  } catch (error) {
    desktopStartupError = errorMessage(error);
  }
}
let desktopDaemon: DesktopDaemonController | null = null;
if (desktopDaemonConfig !== null) {
  desktopDaemon = new DesktopDaemonController(desktopDaemonConfig);
}

if (!runningStageRuntime) {
  bindDesktopDaemonIpc({
    config: desktopDaemonConfig,
    daemon: desktopDaemon,
    startupError: desktopStartupError,
  });
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    height: 900,
    width: 1440,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, "../preload/index.cjs"),
      sandbox: true,
    },
  });

  mainWindows.add(mainWindow);
  mainWindow.once("closed", () => {
    mainWindows.delete(mainWindow);
  });

  const rendererUrl =
    process.env.CONDUIT_FRONTEND_URL ?? process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl === undefined) {
    void mainWindow.loadFile(join(currentDirectory, "../renderer/index.html"));
  } else {
    void mainWindow.loadURL(rendererUrl);
  }

  return mainWindow;
}

if (!runningStageRuntime) {
  const startDesktopDaemon = async (): Promise<void> => {
    try {
      await desktopDaemon?.start();
    } catch (error) {
      desktopStartupError = errorMessage(error);
    }
  };

  const startDesktopRuntime = async (): Promise<void> => {
    createMainWindow();
    await startDesktopDaemon();
  };

  const requestDesktopQuit = async (code: number): Promise<void> => {
    if (desktopShutdownStarted) {
      return;
    }
    desktopShutdownStarted = true;
    try {
      await desktopDaemon?.stop();
    } catch {
      // Quit must still complete after best-effort daemon cleanup.
    }
    desktopShutdownComplete = true;
    app.exit(code);
  };

  const startDesktopRuntimeSafely = async (): Promise<void> => {
    try {
      await startDesktopRuntime();
    } catch (error) {
      desktopStartupError = errorMessage(error);
    }
  };

  app.on("ready", () => {
    void startDesktopRuntimeSafely();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", (event) => {
    if (!desktopShutdownComplete) {
      event.preventDefault();
      void requestDesktopQuit(0);
    }
  });

  process.once("SIGTERM", () => {
    void requestDesktopQuit(0);
  });

  process.once("SIGINT", () => {
    void requestDesktopQuit(0);
  });
}
