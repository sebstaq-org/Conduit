import { createProofSurfaceCopy } from "@conduit/design-system-tokens";
import { contextBridge, ipcRenderer } from "electron";
import type { ProofSurfaceCopy } from "@conduit/design-system-tokens";
import { createSessionClient } from "@conduit/session-client";
import { PROVIDERS } from "@conduit/session-model";

const desktopIpcChannels = {
  copyText: "conduitDesktop:copyText",
  getDaemonStatus: "conduitDesktop:getDaemonStatus",
  getPairingOffer: "conduitDesktop:getPairingOffer",
  restartDaemon: "conduitDesktop:restartDaemon",
} as const;

const supportedSessionClientMethods = ["getSessionGroups"] as const;

interface DesktopBootstrapPlan {
  appId: "desktop";
  copy: ProofSurfaceCopy;
  lockedPolicy: "official-acp-only";
  supportedClientMethods: string[];
  supportedProviders: string[];
}

function createDesktopBootstrapPlan(): DesktopBootstrapPlan {
  const sessionClient = createSessionClient();
  return {
    appId: "desktop",
    copy: createProofSurfaceCopy("desktop"),
    lockedPolicy: sessionClient.policy,
    supportedClientMethods: [...supportedSessionClientMethods],
    supportedProviders: [...PROVIDERS],
  };
}

async function invokeUnknown(
  channel: string,
  value?: string,
): Promise<unknown> {
  const result: unknown = await ipcRenderer.invoke(channel, value);
  return result;
}

contextBridge.exposeInMainWorld("conduitDesktop", {
  copyText: async (value: string): Promise<boolean> => {
    const result = await invokeUnknown(desktopIpcChannels.copyText, value);
    return result === true;
  },
  getDaemonStatus: async (): Promise<unknown> => {
    const status = await invokeUnknown(desktopIpcChannels.getDaemonStatus);
    return status;
  },
  getPairingOffer: async (): Promise<unknown> => {
    const offer = await invokeUnknown(desktopIpcChannels.getPairingOffer);
    return offer;
  },
  restartDaemon: async (): Promise<unknown> => {
    const status = await invokeUnknown(desktopIpcChannels.restartDaemon);
    return status;
  },
});

export { createDesktopBootstrapPlan };
