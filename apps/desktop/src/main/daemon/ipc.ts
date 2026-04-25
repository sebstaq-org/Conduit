import { clipboard, ipcMain } from "electron";
import { fetchDesktopPairingOffer } from "./pairing.js";
import type { DesktopDaemonController } from "./backend.js";
import type { DesktopDaemonConfig, DesktopDaemonStatus } from "./types.js";

const desktopIpcChannels = {
  copyText: "conduitDesktop:copyText",
  getDaemonStatus: "conduitDesktop:getDaemonStatus",
  getPairingOffer: "conduitDesktop:getPairingOffer",
  restartDaemon: "conduitDesktop:restartDaemon",
} as const;

function disabledStatus(): DesktopDaemonStatus {
  return {
    appBaseUrl: "conduit://pair",
    backendHealthy: false,
    daemon: null,
    lastExit: null,
    mobilePeerConnected: false,
    pairingConfigured: false,
    pid: null,
    presence: null,
    relayConfigured: false,
    relayEndpoint: null,
    restartCount: 0,
    running: false,
    sessionWsUrl: null,
  };
}

function bindDesktopDaemonIpc(request: {
  readonly config: DesktopDaemonConfig | null;
  readonly daemon: DesktopDaemonController | null;
}): void {
  ipcMain.handle(desktopIpcChannels.copyText, (_event, value: unknown) => {
    if (typeof value !== "string") {
      throw new TypeError("copyText requires a string");
    }
    clipboard.writeText(value);
    return true;
  });
  ipcMain.handle(desktopIpcChannels.getDaemonStatus, async () => {
    if (request.config === null || request.daemon === null) {
      return disabledStatus();
    }
    const status = await request.daemon.status();
    return status;
  });
  ipcMain.handle(desktopIpcChannels.getPairingOffer, async () => {
    if (request.config === null || request.daemon === null) {
      throw new Error("desktop daemon is not configured");
    }
    const offer = await fetchDesktopPairingOffer(
      request.config,
      request.daemon,
    );
    return offer;
  });
  ipcMain.handle(desktopIpcChannels.restartDaemon, async () => {
    if (request.config === null || request.daemon === null) {
      throw new Error("desktop daemon is not configured");
    }
    const status = await request.daemon.restart();
    return status;
  });
}

export { bindDesktopDaemonIpc };
