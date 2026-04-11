import { app, BrowserWindow } from "electron";
import { join } from "node:path";

const currentDirectory = import.meta.dirname;
const mainWindows = new Set<BrowserWindow>();

app.disableHardwareAcceleration();

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    height: 900,
    width: 1440,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, "../preload/index.js"),
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

app.on("ready", () => {
  createMainWindow();
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
