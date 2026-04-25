import { app, BrowserWindow, protocol } from "electron";
import { join } from "node:path";
import { DesktopDaemonController } from "./daemon/backend.js";
import { readDesktopDaemonConfig } from "./daemon/config.js";
import { bindDesktopDaemonIpc } from "./daemon/ipc.js";
import {
  desktopStaticScheme,
  frontendUrl,
  registerStaticFrontendProtocol,
} from "./daemon/static-frontend-protocol.js";
import type { DesktopDaemonConfig } from "./daemon/types.js";

const currentDirectory = import.meta.dirname;
const mainWindows = new Set<BrowserWindow>();
let desktopShutdownComplete = false;
let desktopShutdownStarted = false;

app.disableHardwareAcceleration();
protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
    scheme: desktopStaticScheme,
  },
]);

const desktopDaemonConfig: DesktopDaemonConfig = readDesktopDaemonConfig();
const desktopDaemon = new DesktopDaemonController(desktopDaemonConfig);
bindDesktopDaemonIpc({
  config: desktopDaemonConfig,
  daemon: desktopDaemon,
});

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

  void mainWindow.loadURL(frontendUrl(desktopDaemonConfig));

  return mainWindow;
}

const startDesktopDaemon = async (): Promise<void> => {
  try {
    await desktopDaemon.start();
  } catch {
    // Recovery state is exposed through daemon status; the renderer stays open.
  }
};

const startDesktopRuntime = async (): Promise<void> => {
  registerStaticFrontendProtocol(desktopDaemonConfig, protocol);
  createMainWindow();
  await startDesktopDaemon();
};

const requestDesktopQuit = async (code: number): Promise<void> => {
  if (desktopShutdownStarted) {
    return;
  }
  desktopShutdownStarted = true;
  try {
    await desktopDaemon.stop();
  } catch {
    // Quit must still complete after best-effort daemon cleanup.
  }
  desktopShutdownComplete = true;
  app.exit(code);
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
