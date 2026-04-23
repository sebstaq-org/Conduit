import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { DesktopDaemonController } from "./daemon/backend.js";
import { readDesktopDaemonConfig } from "./daemon/config.js";
import { bindDesktopDaemonIpc } from "./daemon/ipc.js";
import { runStageRuntimeIfConfigured } from "./stage/runtime.js";
import type { DesktopDaemonConfig } from "./daemon/types.js";

const currentDirectory = import.meta.dirname;
const mainWindows = new Set<BrowserWindow>();

app.disableHardwareAcceleration();

const runningStageRuntime = runStageRuntimeIfConfigured();
let desktopDaemonConfig: DesktopDaemonConfig | null = null;
if (!runningStageRuntime) {
  desktopDaemonConfig = readDesktopDaemonConfig();
}
let desktopDaemon: DesktopDaemonController | null = null;
if (desktopDaemonConfig !== null) {
  desktopDaemon = new DesktopDaemonController(desktopDaemonConfig);
}

if (!runningStageRuntime) {
  bindDesktopDaemonIpc({
    config: desktopDaemonConfig,
    daemon: desktopDaemon,
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
      preload: join(currentDirectory, "../preload/index.mjs"),
      sandbox: false,
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
  const startDesktopRuntime = async (): Promise<void> => {
    await desktopDaemon?.start();
    createMainWindow();
  };

  app.on("ready", () => {
    void startDesktopRuntime();
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

  app.on("before-quit", () => {
    void desktopDaemon?.stop();
  });
}
