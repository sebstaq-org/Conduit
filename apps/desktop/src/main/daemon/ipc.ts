import { clipboard, ipcMain } from "electron";
import { fetchDesktopPairingOffer } from "./pairing.js";
import type { DesktopDaemonController } from "./backend.js";
import type { DesktopDaemonConfig, DesktopRuntimeConfig } from "./types.js";

const desktopIpcChannels = {
  copyText: "conduitDesktop:copyText",
  getDaemonStatus: "conduitDesktop:getDaemonStatus",
  getPairingOffer: "conduitDesktop:getPairingOffer",
  getRuntimeConfig: "conduitDesktop:getRuntimeConfig",
  restartDaemon: "conduitDesktop:restartDaemon",
} as const;

function runtimeConfig(config: DesktopDaemonConfig): DesktopRuntimeConfig {
  return {
    clientLogUrl: `http://${config.backendHost}:${String(config.backendPort)}/api/client-log`,
    logProfile: config.logProfile,
    sessionWsUrl: `ws://${config.backendHost}:${String(config.backendPort)}/api/session`,
  };
}

function bindDesktopDaemonIpc(request: {
  readonly config: DesktopDaemonConfig;
  readonly daemon: DesktopDaemonController;
}): void {
  ipcMain.handle(desktopIpcChannels.copyText, (_event, value: unknown) => {
    if (typeof value !== "string") {
      throw new TypeError("copyText requires a string");
    }
    clipboard.writeText(value);
    return true;
  });
  ipcMain.on(desktopIpcChannels.getRuntimeConfig, (event) => {
    event.returnValue = runtimeConfig(request.config);
  });
  ipcMain.handle(desktopIpcChannels.getDaemonStatus, async () => {
    const status = await request.daemon.status();
    return status;
  });
  ipcMain.handle(desktopIpcChannels.getPairingOffer, async () => {
    const offer = await fetchDesktopPairingOffer(
      request.config,
      request.daemon,
    );
    return offer;
  });
  ipcMain.handle(desktopIpcChannels.restartDaemon, async () => {
    const status = await request.daemon.restart();
    return status;
  });
}

export { bindDesktopDaemonIpc };
