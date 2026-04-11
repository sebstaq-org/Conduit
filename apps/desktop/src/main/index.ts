import { app, BrowserWindow } from "electron";
import { join } from "node:path";

const currentDirectory = import.meta.dirname;

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    height: 900,
    width: 1440,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, "../preload/index.js"),
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl === undefined) {
    void mainWindow.loadFile(join(currentDirectory, "../renderer/index.html"));
  } else {
    void mainWindow.loadURL(rendererUrl);
  }

  return mainWindow;
}

await app.whenReady();

createMainWindow();

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
